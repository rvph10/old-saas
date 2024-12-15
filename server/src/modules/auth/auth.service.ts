import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';
import { SessionService } from './session.service';
import { RedisService } from '../../redis/redis.service';
import { ResetPasswordDto } from './dto/password-reset.dto';
import { MailerService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from 'date-fns';
import { PerformanceService } from '../../common/monitoring/performance.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private redisService: RedisService,
    private mailerService: MailerService,
    private performanceService: PerformanceService
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
  async login(data: {
    loginDto: LoginDto;
    ipAddress: string;
    userAgent: string;
  }) {
    return await this.performanceService.measureAsync('login', async () => {
      try {
        this.performanceService.incrementCounter(`login_attempts_${data.ipAddress}`);
      
      const user = await this.checkIfUserExists({
        username: data.loginDto.username,
        email: data.loginDto.username,
      })

      if (!user || user.deletedAt) {
        this.performanceService.incrementCounter('failed_logins');
        throw new UnauthorizedException('Invalid credentials');
      }
      
      if (!user.isEmailVerified) {
        throw new UnauthorizedException('Please verify your email before logging in');
      }

      const isPasswordValid = await bcrypt.compare(
        data.loginDto.password,
        user.password,
      );
      
      if (!isPasswordValid) {
        this.performanceService.incrementCounter('invalid_passwords');
        throw new UnauthorizedException('Invalid credentials');
      }

      // Track successful logins
      this.performanceService.incrementCounter('successful_logins');
      
      // Track active sessions
      this.performanceService.setGauge('active_sessions', 
        await this.sessionService.getUserSessions(user.id).then(sessions => sessions.length)
      );

        this.addLoginAttempt({
          userId: user.id,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: isPasswordValid,
        });

        const sessionId = await this.sessionService.createSession(user.id, {
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          lastActivity: new Date().toISOString(),
        });

        const token = this.generateToken(user);
        return { ...token, sessionId };
      } catch (error) {
        this.logger.error('Login failed', error.stack);
        throw error;
      }
    });
  }

  async logout(sessionId: string) {
    return await this.performanceService.measureAsync('logout', async () => {
      await this.sessionService.destroySession(sessionId);
      return { message: 'Logged out successfully' };
    });
  }

  async register(registerDto: RegisterDto) {
    return await this.performanceService.measureAsync('register', async () => {
      try {
        this.logger.debug('Starting registration process');
  
        const existingUser = await this.checkIfUserExists({
          email: registerDto.email,
          username: registerDto.username,
        });
  
        if (existingUser) {
          this.performanceService.incrementCounter('duplicate_registrations');
          if (existingUser.email === registerDto.email) {
            throw new ConflictException('Email already in use');
          }
          if (existingUser.username === registerDto.username) {
            throw new ConflictException('Username already in use');
          }
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

        await this.mailerService.sendEmailVerification(user.email, verificationToken);
  
        await this.mailerService.sendWelcome(user.email, user.username);
        return this.generateToken(user);
      } catch (error) {
        this.logger.error('Registration error', error.stack);
        throw error;
      }
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { verificationToken: token }
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
      where: { email }
    });

    if (!user) {
      // Return success even if user doesn't exist (security through obscurity)
      return { message: 'If your email is registered, a verification link has been sent' };
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

    return { message: 'If your email is registered, a verification link has been sent' };
  }

  async requestPasswordReset(email: string) {
    return await this.performanceService.measureAsync('requestPasswordReset', async () => {
      try {
        const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Return success even if user doesn't exist (security)
        return { message: 'If the email exists, a reset link has been sent' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.redisService.set(
        `pwd_reset:${token}`,
        user.id,
        60 * 15,
    );

    await this.mailerService.sendPasswordReset(email, token);

    return { message: 'If the email exists, a reset link has been sent' };
      } catch (error) {
        this.logger.error('Request Password Reset error', error.stack);
        throw error;
      }
    });
}

  async resetPassword(resetDto: ResetPasswordDto) {
    return await this.performanceService.measureAsync('resetPassword', async () => {
      try {
        const userId = await this.redisService.get(`pwd_reset:${resetDto.token}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(resetDto.password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.redisService.del(`pwd_reset:${resetDto.token}`);
    return { message: 'Password successfully reset' };
      } catch (error) {
        this.logger.error('Request Password Reset error', error.stack);
        throw error;
      }
    });
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
