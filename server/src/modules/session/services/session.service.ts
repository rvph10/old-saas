import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { DeviceService } from '../../auth/services/device.service';
import { PerformanceService } from 'src/common/monitoring/performance.service';
import { AppError, SessionError } from 'src/common/errors/custom-errors';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { ErrorHandlingService } from 'src/common/errors/error-handling.service';
import { CookieOptions, Response } from 'express';

interface SessionOptions {
  maxSessions?: number;
  forceLogoutOthers?: boolean;
}

interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  lastActivity?: string;
  deviceId?: string;
  [key: string]: any;
}

@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_TTL = 24 * 60 * 60;
  private readonly SESSION_REFRESH_THRESHOLD = 60 * 60;
  private readonly DEFAULT_MAX_SESSIONS = 5;
  private readonly cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };

  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly deviceService: DeviceService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly performanceService: PerformanceService,
  ) {}

  async createSession(
    userId: string,
    metadata: SessionMetadata = {},
    options: SessionOptions = {},
  ): Promise<string> {
    try {
      const currentSessions = await this.getUserSessions(userId);
      const maxSessions = options.maxSessions ?? this.DEFAULT_MAX_SESSIONS;

      if (currentSessions.length >= maxSessions) {
        if (options.forceLogoutOthers) {
          await Promise.all(
            currentSessions.map((sid) => this.destroySession(sid)),
          );
        } else {
          this.logger.warn(`Session limit reached for user ${userId}`);
          throw new SessionError(
            `Maximum sessions limit (${maxSessions}) reached`,
            {
              code: ErrorCodes.AUTH.SESSION_LIMIT_EXCEEDED,
              currentSessions: currentSessions.length,
              maxSessions,
            },
            'createSession',
          );
        }
      }

      const deviceId = await this.deviceService.registerDevice(
        userId,
        metadata.userAgent || 'unknown',
      );

      const sessionData = {
        userId,
        deviceId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ...metadata,
      };

      const sessionId = uuidv4();
      const key = `${this.SESSION_PREFIX}${sessionId}`;

      await this.redisService.set(
        key,
        JSON.stringify(sessionData),
        this.SESSION_TTL,
      );

      // Track metrics
      this.performanceService.incrementCounter('sessions_created');
      this.performanceService.setGauge(
        `active_sessions_${userId}`,
        (await this.getUserSessions(userId)).length,
      );

      return sessionId;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleSessionError(error, 'createSession');
    }
  }

  async validateSessionLimit(
    userId: string,
    maxSessions: number = this.DEFAULT_MAX_SESSIONS,
  ): Promise<boolean> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length < maxSessions;
  }

  async forceLogoutOtherSessions(
    userId: string,
    currentSessionId: string,
    response?: Response,
  ): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    let logoutCount = 0;

    for (const sessionId of sessions) {
      if (sessionId !== currentSessionId) {
        await this.destroySession(sessionId);
        logoutCount++;
      }
    }

    if (logoutCount === sessions.length - 1) {
      response?.clearCookie('auth_token', this.cookieOptions);
    }

    return logoutCount;
  }

  // Add this helper method to clean up old sessions
  async cleanupOldSessions(
    userId: string,
    maxAgeDays: number = 30,
  ): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    let cleanedCount = 0;

    for (const sessionId of sessions) {
      const session = await this.getSession(sessionId);
      if (session) {
        const createdAt = new Date(session.createdAt);
        const ageInDays =
          (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        if (ageInDays > maxAgeDays) {
          await this.destroySession(sessionId);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.redisService.get(
      `${this.SESSION_PREFIX}${sessionId}`,
    );
    if (!data) return null;

    const session = JSON.parse(data);
    const timeLeft = await this.redisService.ttl(
      `${this.SESSION_PREFIX}${sessionId}`,
    );

    if (timeLeft < this.SESSION_REFRESH_THRESHOLD) {
      await this.refreshSession(sessionId, session);
    }

    return session;
  }

  async revokeToken(jti: string): Promise<void> {
    await this.redisService.set(
      `revoked_token:${jti}`,
      'true',
      24 * 60 * 60
    );
  }
  
  async isTokenRevoked(jti: string): Promise<boolean> {
    return await this.redisService.get(`revoked_token:${jti}`) !== null;
  }

  async revokeDeviceSessions(
    userId: string,
    deviceId: string,
  ): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    let revokedCount = 0;

    for (const sessionId of sessions) {
      const session = await this.getSession(sessionId);
      if (session && session.deviceId === deviceId) {
        await this.destroySession(sessionId);
        revokedCount++;
      }
    }

    // Track metric
    this.performanceService.incrementCounter('device_sessions_revoked');

    return revokedCount;
  }

  async getUserSessionsByDevice(
    userId: string,
    deviceId: string,
  ): Promise<string[]> {
    const sessions = await this.getUserSessions(userId);
    const deviceSessions = [];

    for (const sessionId of sessions) {
      const session = await this.getSession(sessionId);
      if (session && session.deviceId === deviceId) {
        deviceSessions.push(sessionId);
      }
    }

    return deviceSessions;
  }

  async refreshSession(sessionId: string, session: any): Promise<void> {
    session.lastActivity = new Date().toISOString();
    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.SESSION_TTL,
    );
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.trackSessionActivity(sessionId, 'session_destroyed');
    await this.redisService.del(`${this.SESSION_PREFIX}${sessionId}`);
    await this.redisService.del(
      `${this.SESSION_PREFIX}${sessionId}:activities`,
    );
  }

  async validateSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        throw new SessionError(
          'Invalid session',
          { code: ErrorCodes.AUTH.SESSION_EXPIRED },
          'validateSession',
        );
      }

      if (session.userId !== userId) {
        throw new SessionError(
          'Session mismatch',
          { code: ErrorCodes.AUTH.INVALID_TOKEN },
          'validateSession',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleSessionError(error, 'validateSession');
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    const sessions = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
    const userSessions = [];

    for (const session of sessions) {
      const data = await this.redisService.get(session);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.userId === userId) {
          userSessions.push(session.replace(this.SESSION_PREFIX, ''));
        }
      }
    }

    return userSessions;
  }

  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<void> {
    const sessions = await this.getUserSessions(userId);

    for (const sessionId of sessions) {
      if (sessionId !== exceptSessionId) {
        await this.destroySession(sessionId);
      }
    }
  }

  async extendSession(sessionId: string, duration?: number): Promise<void> {
    const maxDuration = 7 * 24 * 60 * 60; // 7 days
    const minDuration = 60 * 15; // 15 minutes

    // Validate duration
    if (duration) {
      if (duration > maxDuration) {
        throw new BadRequestException(
          `Session duration cannot exceed ${maxDuration} seconds`,
        );
      }
      if (duration < minDuration) {
        throw new BadRequestException(
          `Session duration must be at least ${minDuration} seconds`,
        );
      }
    }

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const finalDuration = duration || this.SESSION_TTL;

    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify({ ...session, lastActivity: new Date().toISOString() }),
      finalDuration,
    );

    await this.trackSessionActivity(sessionId, 'Session extended');
  }

  private async trackSessionActivity(
    sessionId: string,
    activity: string,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const activityLog = {
        timestamp: new Date().toISOString(),
        activity,
        sessionId,
        userId: session.userId,
      };

      await this.redisService.set(
        `${this.SESSION_PREFIX}${sessionId}:activities`,
        JSON.stringify(activityLog),
        this.SESSION_TTL,
      );
    }
  }
}
