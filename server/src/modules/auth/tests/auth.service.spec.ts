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
import { LocationService } from '../services/location.service';
import { TwoFactorService } from '../services/two-factor.service';
import { PasswordService } from '../services/password.service';
import { PasswordValidationError } from 'src/common/errors/custom-errors';

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
    },
  };

  const mockPasswordService = {
    validatePassword: jest.fn(),
    validatePasswordStrength: jest.fn(),
    checkPasswordBreached: jest.fn(),
  };

  const mockTwoFactorService = {
    generateSecret: jest.fn(),
    verifyToken: jest.fn(),
    enable2FA: jest.fn(),
    disable2FA: jest.fn(),
  };

  const mockLocationService = {
    isNewLoginLocation: jest.fn(),
    getLocationInfo: jest.fn(),
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
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: PerformanceService, useValue: mockPerformanceService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: LocationService, useValue: mockLocationService },
        { provide: PasswordService, useValue: mockPasswordService },
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
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
    };

    beforeEach(() => {
      // Reset password validation mock
      mockPasswordService.validatePassword.mockReset();
    });

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashedPassword';
      const verificationToken = 'test-token';
      const verificationExpiry = new Date();

      mockPasswordService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });

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

    it('should throw PasswordValidationError for invalid password', async () => {
      mockPasswordService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password too weak'],
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        PasswordValidationError,
      );
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
      const loginDto = {
        username: 'testuser',
        password: 'correctpassword',
      };

      const user = {
        id: '1',
        username: loginDto.username,
        password: await bcrypt.hash('correctpassword', 10),
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
        {},
      );
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
      ('Password must be different from recent passwords, please choose a new one');
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
          'Invalid credentials, please try again',
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
          /Account temporarily locked for security. Please try again in \d+ minutes/,
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
        password: 'correctpassword',
      };

      const user = {
        id: '1',
        username: loginDto.username,
        password: await bcrypt.hash('correctpassword', 10),
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
          lastActivity: expect.any(String),
        }),
        {},
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

  describe('resetPassword', () => {
    const token = 'reset-token';
    const userId = 'user-id';
    const newPassword = 'NewPassword123!';

    beforeEach(() => {
      mockPasswordService.validatePassword.mockReset();
    });

    it('should reset password successfully', async () => {
      mockRedisService.get.mockResolvedValue(userId);
      mockPrismaService.passwordHistory.findMany.mockResolvedValue([]);
      mockPasswordService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      await service.resetPassword({ token, password: newPassword });

      expect(mockPasswordService.validatePassword).toHaveBeenCalledWith(
        newPassword,
      );
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw PasswordValidationError for invalid new password', async () => {
      mockRedisService.get.mockResolvedValue(userId);
      mockPasswordService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password too weak'],
      });

      await expect(
        service.resetPassword({ token, password: 'weak' }),
      ).rejects.toThrow(PasswordValidationError);
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
        { password: await bcrypt.hash(newPassword, 10) },
      ]);

      await expect(
        service.checkPasswordHistory(userId, newPassword),
      ).rejects.toThrow(
        'Password must be different from recent passwords, please choose a new one',
      );
    });

    it('should save password to history', async () => {
      const userId = '1';
      const hashedPassword = 'hashedPassword123';

      await service.savePasswordToHistory(userId, hashedPassword);

      expect(mockPrismaService.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId,
          password: hashedPassword,
        },
      });
    });
  });

  describe('email verification', () => {
    it('should resend verification email successfully', async () => {
      const email = 'test@example.com';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        isEmailVerified: false,
      });

      const result = await service.resendVerificationEmail(email);

      expect(result.message).toBe(
        'If your email is registered, a verification link has been sent',
      );
      expect(mockMailerService.sendEmailVerification).toHaveBeenCalled();
    });

    it('should handle already verified email', async () => {
      const email = 'test@example.com';
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        isEmailVerified: true,
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
          deletedAt: expect.any(Date),
        },
      });
    });
  });

  describe('logoutAllDevices', () => {
    const userId = '1';

    it('should logout from all devices except current', async () => {
      const currentSessionId = 'current-session';
      mockSessionService.getUserSessions.mockResolvedValue([
        'session1',
        'session2',
        currentSessionId,
      ]);

      const result = await service.logoutAllDevices(userId, currentSessionId);

      expect(result.sessionsTerminated).toBe(2);
      expect(mockSessionService.destroySession).toHaveBeenCalledTimes(2);
    });

    it('should logout from all devices', async () => {
      mockSessionService.getUserSessions.mockResolvedValue([
        'session1',
        'session2',
        'session3',
      ]);

      const result = await service.logoutAllDevices(userId);

      expect(result.sessionsTerminated).toBe(3);
      expect(mockSessionService.destroySession).toHaveBeenCalledTimes(3);
    });
  });
});
