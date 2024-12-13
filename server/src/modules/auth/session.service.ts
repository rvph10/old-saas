import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_TTL = 24 * 60 * 60;
  private readonly SESSION_REFRESH_THRESHOLD = 60 * 60;

  constructor(private readonly redisService: RedisService) {}

  async createSession(userId: string, metadata: any = {}): Promise<string> {
    const sessionId = uuidv4();
    const sessionData = {
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ...metadata,
    };

    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      this.SESSION_TTL,
    );

    return sessionId;
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

  async refreshSession(sessionId: string, session: any): Promise<void> {
    session.lastActivity = new Date().toISOString();
    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.SESSION_TTL,
    );
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.redisService.del(`${this.SESSION_PREFIX}${sessionId}`);
  }

  async validateSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session?.userId === userId;
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
}
