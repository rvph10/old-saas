import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.spyOn(service, 'getDefaultRole').mockResolvedValue({
      id: 'default-role-id',
      name: 'user',
      permissions: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    jest.spyOn(service, 'checkIfUserExists').mockImplementation(async (data) => {
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
      mockPrismaService.user.findFirst.mockResolvedValue({ id: '1' });

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
});