import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SessionService } from '../services/session.service';
import { RedisService } from '../../../redis/redis.service';
import { MailerService } from '../../mail/mail.service';
import { PerformanceService } from 'src/common/monitoring/performance.service';
import { addMinutes, subMinutes } from 'date-fns';
import { isEmail } from 'class-validator';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    loginHistory: {
      create: jest.fn(),
    },
    passwordHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    }
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn(),
    destroySession: jest.fn(),
    getSession: jest.fn(),
    getUserSessions: jest.fn().mockResolvedValue([]),
    revokeAllUserSessions: jest.fn(),
  };

  const mockPerformanceService = {
    measureAsync: jest.fn((name, fn) => fn()),
    getMetricsSummary: jest.fn().mockReturnValue({
      timers: {},
      counters: {},
      gauges: {},
    }),
    incrementCounter: jest.fn(),
    setGauge: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendWelcome: jest.fn(),
    sendEmailVerification: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    mockSessionService.destroySession.mockClear();
    mockSessionService.getUserSessions.mockClear();

    jest.clearAllMocks();

    mockPrismaService.user.update = jest
      .fn()
      .mockImplementation(({ data }) => ({
        ...data,
        id: '1',
      }));

    jest.spyOn(service, 'getDefaultRole').mockResolvedValue({
      id: 'default-role-id',
      name: 'user',
      permissions: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    jest
      .spyOn(service, 'checkIfUserExists')
      .mockImplementation(async (data) => {
        const result = await mockPrismaService.user.findFirst();
        if (!result) {
          return null;
        }
        return result;
      });
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashedPassword';
      const verificationToken = 'test-token';
      const verificationExpiry = new Date();

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...registerDto,
        id: '1',
        password: hashedPassword,
        roleId: 'default-role-id',
        isEmailVerified: false,
        verificationToken,
        verificationExpiry,
      });
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(mockMailerService.sendEmailVerification).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...registerDto,
          password: hashedPassword,
          roleId: 'default-role-id',
          isEmailVerified: false,
          verificationToken: expect.any(String),
          verificationExpiry: expect.any(Date),
        },
        include: {
          role: true,
        },
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      const existingUser = {
        id: '1',
        email: registerDto.email,
        username: registerDto.username,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('should login successfully with correct credentials', async () => {
      const user = {
        id: '1',
        username: loginDto.username,
        password: 'hashedPassword',
        email: 'test@example.com',
        isEmailVerified: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.login({
        loginDto,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedException with incorrect password', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        password: 'hashedPassword',
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login({
          loginDto,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      const user = {
        id: '1',
        username: loginDto.username,
        password: 'hashedPassword',
        email: 'test@example.com',
        isEmailVerified: false,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(user);

      await expect(
        service.login({
          loginDto,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          loginDto,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
    describe('account locking', () => {
      const loginData = {
        loginDto: {
          username: 'testuser',
          password: 'wrongpassword',
        },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      it('should increment failed login attempts', async () => {
        const user = {
          id: '1',
          username: loginData.loginDto.username,
          password: 'hashedpassword',
          failedLoginAttempts: 0,
          isEmailVerified: true,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(user);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

        await expect(service.login(loginData)).rejects.toThrow(
          'Invalid credentials',
        );

        expect(mockPrismaService.user.update).toHaveBeenCalledWith({
          where: { id: '1' },
          data: expect.objectContaining({
            failedLoginAttempts: 1,
            lastFailedLoginAttempt: expect.any(Date),
          }),
        });
      });

      it('should lock account after 8 failed attempts', async () => {
        const user = {
          id: '1',
          username: loginData.loginDto.username,
          password: 'hashedpassword',
          failedLoginAttempts: 7,
          isEmailVerified: true,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(user);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

        await expect(service.login(loginData)).rejects.toThrow(
          'Account locked for 15 minutes due to too many failed attempts',
        );
      });

      it('should prevent login when account is locked', async () => {
        const lockExpires = addMinutes(new Date(), 10);
        const user = {
          id: '1',
          username: loginData.loginDto.username,
          password: 'hashedpassword',
          failedLoginAttempts: 5,
          accountLocked: true,
          lockExpires,
          isEmailVerified: true,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(user);

        await expect(service.login(loginData)).rejects.toThrow(
          /Account locked. Try again in \d+ minutes/
        );
      });

      it('should reset failed attempts on successful login', async () => {
        const user = {
          id: '1',
          username: loginData.loginDto.username,
          password: await bcrypt.hash('correctpassword', 10),
          failedLoginAttempts: 2,
          isEmailVerified: true,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(user);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
        mockJwtService.sign.mockReturnValue('jwt_token');

        await service.login({
          ...loginData,
          loginDto: { ...loginData.loginDto, password: 'correctpassword' },
        });

        expect(mockPrismaService.user.update).toHaveBeenCalledWith({
          where: { id: user.id },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            accountLocked: false,
            lockExpires: null,
          }),
        });
      });

      it('should automatically unlock account after lock expires', async () => {
        const lockExpires = subMinutes(new Date(), 1); // Lock expired 1 minute ago
        const user = {
          id: '1',
          username: loginData.loginDto.username,
          password: await bcrypt.hash('correctpassword', 10),
          failedLoginAttempts: 5,
          accountLocked: true,
          lockExpires,
          isEmailVerified: true,
        };

        mockPrismaService.user.findFirst.mockResolvedValue(user);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
        mockJwtService.sign.mockReturnValue('jwt_token');

        await service.login({
          ...loginData,
          loginDto: { ...loginData.loginDto, password: 'correctpassword' },
        });

        expect(mockPrismaService.user.update).toHaveBeenCalledWith({
          where: { id: user.id },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            accountLocked: false,
            lockExpires: null,
          }),
        });
      });
    });
  });

  describe('createUser', () => {
    it('should create a new user with default role', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const defaultRole = { id: 'default-role-id', name: 'user' };
      mockPrismaService.role.findFirst.mockResolvedValue(defaultRole);
      mockPrismaService.user.create.mockResolvedValue({
        ...userData,
        id: '1',
        role: defaultRole,
        roleId: defaultRole.id,
        isEmailVerified: false,
      });

      const result = await service.createUser(userData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('role');
      expect(result.role).toEqual(defaultRole);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          username: userData.username,
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          roleId: defaultRole.id,
          isEmailVerified: false,
        },
        include: {
          role: true,
        },
      });
    });
  });

  describe('addLoginAttempt', () => {
    it('should add a login attempt successfully', async () => {
      const loginAttemptData = {
        userId: '1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        success: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue({ id: '1' });
      mockPrismaService.loginHistory.create.mockResolvedValue(loginAttemptData);

      const result = await service.addLoginAttempt(loginAttemptData);

      expect(result).toEqual(loginAttemptData);
      expect(mockPrismaService.loginHistory.create).toHaveBeenCalledWith({
        data: loginAttemptData,
      });
    });

    it('should throw an error if user does not exist', async () => {
      const loginAttemptData = {
        userId: '1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        success: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.addLoginAttempt(loginAttemptData)).rejects.toThrow(
        'User does not exist',
      );
    });
  });

  describe('login with session', () => {
    it('should create session on successful login', async () => {
      const loginDto = {
        username: 'testuser',
        password: 'password123',
      };

      const user = {
        id: '1',
        username: loginDto.username,
        password: 'hashedPassword',
        email: 'test@example.com',
        isEmailVerified: true,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('jwt_token');
      mockSessionService.createSession.mockResolvedValue('session-id');

      const result = await service.login({
        loginDto,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result).toHaveProperty('sessionId');
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      );
    });
  });

  describe('logout', () => {
    it('should destroy session on logout', async () => {
      const sessionId = 'test-session';
      await service.logout(sessionId);

      expect(mockSessionService.destroySession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('password reset', () => {
    const email = 'test@example.com';
    const token = 'reset-token';
    const userId = 'user-id';

    it('should handle password reset request successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        email,
      });

      await service.requestPasswordReset(email);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('pwd_reset:'),
        userId,
        15 * 60, // 15 minutes
      );
      expect(mockMailerService.sendPasswordReset).toHaveBeenCalledWith(
        email,
        expect.any(String),
      );
    });

    it('should handle non-existent email for password reset', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset(email);

      expect(result.message).toBe(
        'If the email exists, a reset link has been sent',
      );
      expect(mockRedisService.set).not.toHaveBeenCalled();
      expect(mockMailerService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should reset password successfully', async () => {
      const newPassword = 'newPassword123!';
      mockRedisService.get.mockResolvedValue(userId);
      mockPrismaService.passwordHistory.findMany.mockResolvedValue([]);
  
      await service.resetPassword({ token, password: newPassword });
  
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: expect.any(String) },
      });
      expect(mockRedisService.del).toHaveBeenCalledWith(`pwd_reset:${token}`);
    });

    it('should throw UnauthorizedException for invalid reset token', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token, password: 'newPassword123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Email Verification', () => {
    const verificationToken = 'test-token';
    const email = 'test@example.com';

    describe('verifyEmail', () => {
      it('should verify email successfully', async () => {
        const user = {
          id: '1',
          email,
          isEmailVerified: false,
          verificationToken,
          verificationExpiry: addMinutes(new Date(), 15),
        };

        mockPrismaService.user.findUnique.mockResolvedValue(user);
        mockPrismaService.user.update.mockResolvedValue({
          ...user,
          isEmailVerified: true,
        });

        const result = await service.verifyEmail(verificationToken);
        expect(result.message).toBe('Email verified successfully');
      });

      it('should throw error for invalid token', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue(null);

        await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw error for expired token', async () => {
        const pastDate = new Date();
        pastDate.setMinutes(pastDate.getMinutes() - 30);

        const user = {
          id: '1',
          email,
          isEmailVerified: false,
          verificationToken,
          verificationExpiry: pastDate,
        };

        mockPrismaService.user.findUnique.mockResolvedValue(user);

        await expect(service.verifyEmail(verificationToken)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });
  });

  describe('Password History', () => {
    it('should prevent reuse of recent passwords', async () => {
      const userId = '1';
      const newPassword = 'newPassword123!';
      mockPrismaService.passwordHistory.findMany.mockResolvedValue([
        { password: await bcrypt.hash(newPassword, 10) }
      ]);
  
      await expect(service.checkPasswordHistory(userId, newPassword))
        .rejects.toThrow('Cannot reuse one of your last 5 passwords');
    });
  
    it('should save password to history', async () => {
      const userId = '1';
      const hashedPassword = 'hashedPassword123';

      await service.savePasswordToHistory(userId, hashedPassword);
      
      expect(mockPrismaService.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId,
          password: hashedPassword
        }
      });
    });
  });
  
  describe('email verification', () => {
    it('should resend verification email successfully', async () => {
      const email = 'test@example.com';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        isEmailVerified: false
      });
  
      const result = await service.resendVerificationEmail(email);
      
      expect(result.message).toBe('If your email is registered, a verification link has been sent');
      expect(mockMailerService.sendEmailVerification).toHaveBeenCalled();
    });
  
    it('should handle already verified email', async () => {
      const email = 'test@example.com';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        isEmailVerified: true
      });
  
      const result = await service.resendVerificationEmail(email);
      expect(result.message).toBe('Email already verified');
    });
  });
  
  describe('blockAccount', () => {
    it('should block user account', async () => {
      const userId = '1';
      await service.blockAccount(userId);
  
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          deletedAt: expect.any(Date)
        }
      });
    });
  });
  
  describe('logoutAllDevices', () => {
    const userId = '1';
    
    it('should logout from all devices except current', async () => {
      const currentSessionId = 'current-session';
      mockSessionService.getUserSessions.mockResolvedValue(['session1', 'session2', currentSessionId]);
  
      const result = await service.logoutAllDevices(userId, currentSessionId);
  
      expect(result.sessionsTerminated).toBe(2);
      expect(mockSessionService.destroySession).toHaveBeenCalledTimes(2);
    });
  
    it('should logout from all devices', async () => {
      mockSessionService.getUserSessions.mockResolvedValue(['session1', 'session2', 'session3']);
  
      const result = await service.logoutAllDevices(userId);
  
      expect(result.sessionsTerminated).toBe(3);
      expect(mockSessionService.destroySession).toHaveBeenCalledTimes(3);
    });
  });
});
