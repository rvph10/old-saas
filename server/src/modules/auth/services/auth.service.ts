import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import * as bcrypt from 'bcryptjs';
import { SessionService } from './session.service';
import { RedisService } from '../../../redis/redis.service';
import { ResetPasswordDto } from '../dto/password-reset.dto';
import { MailerService } from '../../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';
import { PasswordService } from './password.service';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { PerformanceService } from '../../../common/monitoring/performance.service';
import { LocationService } from './location.service';
import {
  AccountError,
  AppError,
  AuthenticationError,
  AuthorizationError,
  PasswordValidationError,
  ValidationError,
} from 'src/common/errors/custom-errors';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { ErrorHandlingService } from 'src/common/errors/error-handling.service';

export interface SessionOptions {
  maxSessions?: number;
  forceLogoutOthers?: boolean;
}

interface LoginParams {
  loginDto: LoginDto;
  ipAddress: string;
  userAgent: string;
  sessionOptions?: SessionOptions;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private redisService: RedisService,
    private mailerService: MailerService,
    private performanceService: PerformanceService,
    private locationService: LocationService,
    private passwordService: PasswordService,
    private errorHandlingService: ErrorHandlingService,
  ) {}

  /**
   * Region for Prisma queries
   */

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    verificationToken?: string;
    verificationExpiry?: Date;
    isEmailVerified?: boolean;
  }) {
    const defaultRole = await this.getDefaultRole();
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        roleId: defaultRole.id,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        verificationToken: data.verificationToken,
        verificationExpiry: data.verificationExpiry,
        isEmailVerified: false,
      },
      include: {
        role: true,
      },
    });
  }

  async getDefaultRole() {
    this.logger.debug('Getting default role');
    const defaultRole = await this.prisma.role.findFirst({
      where: {
        name: 'user',
      },
    });
    if (!defaultRole) {
      this.logger.debug('Default role not found, creating one');
      return this.prisma.role.create({
        data: {
          name: 'user',
          permissions: {
            create: {
              name: 'read',
            },
          },
        },
      });
    }
    return defaultRole;
  }

  async addLoginAttempt(data: {
    userId: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
  }) {
    if (!data.userId) throw new Error('User id is required');
    if (!data.ipAddress) throw new Error('IP Address is required');

    const userExists = await this.checkIfUserExists({ id: data.userId });
    if (!userExists) {
      throw new Error('User does not exist');
    }

    return this.prisma.loginHistory.create({
      data: {
        userId: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success,
      },
    });
  }

  async checkIfUserExists(data: {
    username?: string;
    email?: string;
    id?: string;
  }) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
          { id: data.id },
        ],
        deletedAt: null,
      },
    });
  }

  async getUser(data: { username?: string; email?: string; id?: string }) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
          { id: data.id },
        ],
        deletedAt: null,
      },
    });
  }

  /**
   * End region
   */

  /**
   * Region for Auth methods
   */
  async login({
    loginDto,
    ipAddress,
    userAgent,
    sessionOptions = {},
  }: LoginParams) {
    return await this.performanceService.measureAsync('login', async () => {
      try {
        const user = await this.checkIfUserExists({
          username: loginDto.username,
          email: loginDto.username,
        });

        if (!user) {
          this.performanceService.incrementCounter('failed_logins');
          throw new AuthenticationError(
            'Invalid credentials',
            { code: ErrorCodes.AUTH.INVALID_CREDENTIALS },
            'login',
          );
        }

        if (user.deletedAt) {
          this.performanceService.incrementCounter('failed_logins');
          throw new AuthenticationError(
            'Email verification required. Please check your email.',
            { code: ErrorCodes.AUTH.EMAIL_NOT_VERIFIED },
            'login',
          );
        }

        if (user.accountLocked && user.lockExpires) {
          if (user.lockExpires > new Date()) {
            const remainingMinutes = differenceInMinutes(
              user.lockExpires,
              new Date(),
            );
            throw new AccountError(
              `Account temporarily locked. Try again in ${remainingMinutes} minutes`,
              {
                code: ErrorCodes.AUTH.ACCOUNT_LOCKED,
                remainingMinutes,
              },
              'login',
            );
          }
        }

        if (!user.isEmailVerified) {
          throw new AuthenticationError(
            'Email verification required. Please check your email.',
            { code: ErrorCodes.AUTH.EMAIL_NOT_VERIFIED },
            'login',
          );
        }

        // Check if account is locked
        if (user.accountLocked && user.lockExpires) {
          if (user.lockExpires > new Date()) {
            const remainingMinutes = differenceInMinutes(
              user.lockExpires,
              new Date(),
            );
            throw new UnauthorizedException(
              `Account temporarily locked for security. Please try again in ${remainingMinutes} minutes`,
            );
          } else {
            await this.resetFailedAttempts(user.id);
          }
        }

        const isPasswordValid = await bcrypt.compare(
          loginDto.password,
          user.password,
        );

        if (!isPasswordValid) {
          await this.handleFailedLogin(user);
          throw new AuthenticationError(
            'Invalid credentials',
            { code: ErrorCodes.AUTH.INVALID_CREDENTIALS },
            'login',
          );
        } else {
          const isNewLocation = await this.locationService.isNewLoginLocation(
            user.id,
            ipAddress,
          );

          if (isNewLocation) {
            const locationInfo =
              this.locationService.getLocationInfo(ipAddress);
            await this.mailerService.sendLoginAlert(user.email, {
              ip: ipAddress,
              browser: userAgent,
              location: locationInfo,
              time: new Date(),
            });
          }

          // If 2FA is enabled, return a different response
          if (user.twoFactorEnabled) {
            return {
              requires2FA: true,
              tempToken: this.generateTempToken(user),
            };
          }
        }

        // Reset failed attempts on successful login
        await this.resetFailedAttempts(user.id);

        // Track successful logins
        this.performanceService.incrementCounter('successful_logins');

        // Track active sessions
        this.performanceService.setGauge(
          'active_sessions',
          await this.sessionService
            .getUserSessions(user.id)
            .then((sessions) => sessions.length),
        );

        this.addLoginAttempt({
          userId: user.id,
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: isPasswordValid,
        });

        const sessionId = await this.sessionService.createSession(
          user.id,
          {
            ipAddress,
            userAgent,
            lastActivity: new Date().toISOString(),
          },
          sessionOptions,
        );

        const token = this.generateToken(user);
        return { ...token, sessionId };
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        this.errorHandlingService.handleAuthenticationError(error, 'login');
      }
    });
  }

  private generateTempToken(user: any) {
    const payload = {
      sub: user.id,
      type: '2fa-pending',
      exp: Math.floor(Date.now() / 1000) + 5 * 60,
    };
    return this.jwtService.sign(payload);
  }

  async checkPasswordHistory(
    userId: string,
    newPassword: string,
  ): Promise<boolean> {
    const recentPasswords = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const historical of recentPasswords) {
      if (await bcrypt.compare(newPassword, historical.password)) {
        throw new PasswordValidationError([
          'Password cannot be the same as any of the last 5 passwords',
        ]);
      }
    }

    return true;
  }

  async savePasswordToHistory(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await this.prisma.passwordHistory.create({
      data: {
        userId,
        password: hashedPassword,
      },
    });
  }

  async blockAccount(userId: string) {
    //TODO: Update to use Permissions and Roles
    return await this.performanceService.measureAsync(
      'blockAccount',
      async () => {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
          },
        });
      },
    );
  }

  async logoutAllDevices(
    userId: string,
    keepSessionId?: string,
  ): Promise<{ message: string; sessionsTerminated: number }> {
    return await this.performanceService.measureAsync(
      'logoutAllDevices',
      async () => {
        const sessions = await this.sessionService.getUserSessions(userId);
        let terminatedCount = 0;

        for (const sessionId of sessions) {
          if (!keepSessionId || sessionId !== keepSessionId) {
            await this.sessionService.destroySession(sessionId);
            terminatedCount++;
          }
        }

        // Track metrics
        this.performanceService.incrementCounter('mass_logout_events');
        this.performanceService.setGauge(
          'active_sessions_' + userId,
          keepSessionId ? 1 : 0,
        );

        return {
          message: keepSessionId
            ? 'Logged out from all other devices'
            : 'Logged out from all devices',
          sessionsTerminated: terminatedCount,
        };
      },
    );
  }

  private async handleFailedLogin(user: any) {
    const MAX_ATTEMPTS = 8;
    const LOCK_TIME = 15;

    const attempts = (user.failedLoginAttempts || 0) + 1;
    const updateData: any = {
      failedLoginAttempts: attempts,
      lastFailedLoginAttempt: new Date(),
    };

    if (attempts >= MAX_ATTEMPTS) {
      updateData.accountLocked = true;
      updateData.lockExpires = addMinutes(new Date(), LOCK_TIME);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (attempts >= MAX_ATTEMPTS) {
      throw new AuthorizationError(
        `Account locked for ${LOCK_TIME} minutes due to too many failed attempts`,
      );
    }
  }

  private async resetFailedAttempts(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        accountLocked: false,
        lockExpires: null,
      },
    });
  }

  async logout(sessionId: string) {
    return await this.performanceService.measureAsync('logout', async () => {
      await this.sessionService.destroySession(sessionId);
      return { message: 'Logged out successfully' };
    });
  }

  async logoutAll(userId: string) {
    return await this.performanceService.measureAsync('logoutAll', async () => {
      await this.sessionService.revokeAllUserSessions(userId);
      return { message: 'Logged out of all sessions' };
    });
  }

  async register(registerDto: RegisterDto) {
    return await this.performanceService.measureAsync('register', async () => {
      try {
        const existingUser = await this.checkIfUserExists({
          email: registerDto.email,
          username: registerDto.username,
        });

        if (existingUser) {
          this.performanceService.incrementCounter('duplicate_registrations');
          if (existingUser.email === registerDto.email) {
            throw new ValidationError(
              'Email already in use',
              { code: ErrorCodes.ACCOUNT.ALREADY_EXISTS },
              'register',
            );
          }
          if (existingUser.username === registerDto.username) {
            throw new ValidationError(
              'Username already taken',
              { code: ErrorCodes.ACCOUNT.ALREADY_EXISTS },
              'register',
            );
          }
        }
        const passwordValidation = await this.passwordService.validatePassword(
          registerDto.password,
        );

        if (!passwordValidation.isValid) {
          throw new ValidationError(
            'Password validation failed',
            {
              code: ErrorCodes.VALIDATION.INVALID_PASSWORD,
              errors: passwordValidation.errors,
            },
            'register',
          );
        }

        this.performanceService.incrementCounter('successful_registrations');
        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        const verificationToken = uuidv4();
        const verificationExpiry = addMinutes(new Date(), 15);

        const user = await this.createUser({
          username: registerDto.username,
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          verificationToken,
          verificationExpiry,
        });
        await this.savePasswordToHistory(user.id, hashedPassword);

        await this.mailerService.sendEmailVerification(
          user.email,
          verificationToken,
        );

        await this.mailerService.sendWelcome(user.email, user.username);
        return this.generateToken(user);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        this.errorHandlingService.handleValidationError(error, 'register');
      }
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified' };
    }

    if (user.verificationExpiry && new Date() > user.verificationExpiry) {
      throw new UnauthorizedException('Verification token has expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success even if user doesn't exist (security through obscurity)
      return {
        message:
          'If your email is registered, a verification link has been sent',
      };
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified' };
    }

    // Generate new verification token
    const verificationToken = uuidv4();
    const verificationExpiry = addMinutes(new Date(), 15);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpiry,
      },
    });

    await this.mailerService.sendEmailVerification(email, verificationToken);

    return {
      message: 'If your email is registered, a verification link has been sent',
    };
  }

  async requestPasswordReset(email: string) {
    return await this.performanceService.measureAsync(
      'requestPasswordReset',
      async () => {
        try {
          const user = await this.prisma.user.findUnique({ where: { email } });
          if (!user) {
            return {
              message: 'If the email exists, a reset link has been sent',
            };
          }

          const token = crypto.randomBytes(32).toString('hex');
          await this.redisService.set(`pwd_reset:${token}`, user.id, 60 * 15);

          await this.mailerService.sendPasswordReset(email, token);

          return { message: 'If the email exists, a reset link has been sent' };
        } catch (error) {
          this.logger.error('Request Password Reset error', error.stack);
          throw error;
        }
      },
    );
  }

  async resetPassword(resetDto: ResetPasswordDto) {
    return await this.performanceService.measureAsync(
      'resetPassword',
      async () => {
        try {
          const userId = await this.redisService.get(
            `pwd_reset:${resetDto.token}`,
          );
          if (!userId) {
            throw new UnauthorizedException('Invalid or expired reset token');
          }

          const passwordValidation =
            await this.passwordService.validatePassword(resetDto.password);

          if (!passwordValidation.isValid) {
            throw new PasswordValidationError(passwordValidation.errors);
          }

          await this.checkPasswordHistory(userId, resetDto.password);

          const hashedPassword = await bcrypt.hash(resetDto.password, 10);
          await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
          });
          this.sessionService.revokeAllUserSessions(userId);
          await this.savePasswordToHistory(userId, hashedPassword);

          await this.redisService.del(`pwd_reset:${resetDto.token}`);
          return { message: 'Password successfully reset' };
        } catch (error) {
          this.logger.error('Request Password Reset error', error.stack);
          throw error;
        }
      },
    );
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
  /**
   * End region
   */
}
