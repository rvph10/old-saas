import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SessionService } from '../session.service';
import { RedisService } from '../../../redis/redis.service';
import { MailerService } from '../../mail/mail.service';
import { PerformanceService } from 'src/common/monitoring/performance.service';

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
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn(),
    destroySession: jest.fn(),
    getSession: jest.fn(),
    getUserSessions: jest.fn().mockResolvedValue([])
  };

  const mockPerformanceService = {
    measureAsync: jest.fn((name, fn) => fn()),
    getMetricsSummary: jest.fn().mockReturnValue({
      timers: {},
      counters: {},
      gauges: {}
    }),
    incrementCounter: jest.fn(),
    setGauge: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendWelcome: jest.fn(),
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
        }
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();

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
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...registerDto,
        id: '1',
        password: hashedPassword,
        roleId: 'default-role-id',
      });
      mockJwtService.sign.mockReturnValue('jwt_token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...registerDto,
          password: hashedPassword,
          roleId: 'default-role-id',
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
      });

      const result = await service.createUser(userData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('role');
      expect(result.role).toEqual(defaultRole);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...userData,
          roleId: defaultRole.id,
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
});
