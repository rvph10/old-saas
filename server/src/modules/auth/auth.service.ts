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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private redisService: RedisService,
    private mailerService: MailerService,
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
  }) {
    const defaultRole = await this.getDefaultRole();
    this.logger.debug('Creating user in database');
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        roleId: defaultRole.id,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
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
    const user = await this.getUser({ username: data.loginDto.username });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      data.loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
  }

  async logout(sessionId: string) {
    await this.sessionService.destroySession(sessionId);
    return { message: 'Logged out successfully' };
  }

  async register(registerDto: RegisterDto) {
    try {
      this.logger.debug('Starting registration process');

      const existingUser = await this.checkIfUserExists({
        email: registerDto.email,
        username: registerDto.username,
      });

      if (existingUser) {
        if (existingUser.email === registerDto.email) {
          throw new ConflictException('Email already in use');
        }
        if (existingUser.username === registerDto.username) {
          throw new ConflictException('Username already in use');
        }
      }
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      const user = await this.createUser({
        username: registerDto.username,
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      this.logger.debug('User created successfully', user);
      return this.generateToken(user);
    } catch (error) {
      this.logger.error('Registration failed', {
        error: error.message,
        stack: error.stack,
        username: registerDto.username,
        email: registerDto.email,
      });
      throw error;
    }
  }

  async requestPasswordReset(email: string) {
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
}

  async resetPassword(resetDto: ResetPasswordDto) {
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
