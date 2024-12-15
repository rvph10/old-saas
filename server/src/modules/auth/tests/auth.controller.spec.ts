import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { UnauthorizedException } from '@nestjs/common';
import { PerformanceService } from 'src/common/monitoring/performance.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let sessionService: SessionService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };

  const mockSessionService = {
    getSession: jest.fn(),
    destroySession: jest.fn(),
    getUserSessions: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    sessionService = module.get<SessionService>(SessionService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      const expectedResponse = {
        access_token: 'jwt_token',
        user: {
          id: '1',
          ...registerDto,
        },
      };

      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registerDto);

      expect(result).toBe(expectedResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto = {
      username: 'testuser',
      password: 'Password123!',
    };

    const mockRequest = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-browser',
      },
    };

    it('should login successfully', async () => {
      const expectedResponse = {
        access_token: 'jwt_token',
        sessionId: 'session-id',
        user: {
          id: '1',
          username: 'testuser',
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto, mockRequest as any);

      expect(result).toBe(expectedResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith({
        loginDto,
        ipAddress: mockRequest.ip,
        userAgent: mockRequest.headers['user-agent'],
      });
    });
  });

  describe('password reset', () => {
    const requestResetDto = {
      email: 'test@example.com',
    };

    const resetPasswordDto = {
      token: 'reset-token',
      password: 'NewPassword123!',
    };

    it('should request password reset successfully', async () => {
      const expectedResponse = {
        message: 'If the email exists, a reset link has been sent',
      };

      mockAuthService.requestPasswordReset.mockResolvedValue(expectedResponse);

      const result = await controller.requestPasswordReset(requestResetDto);

      expect(result).toBe(expectedResponse);
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(
        requestResetDto.email,
      );
    });

    it('should reset password successfully', async () => {
      const expectedResponse = {
        message: 'Password successfully reset',
      };

      mockAuthService.resetPassword.mockResolvedValue(expectedResponse);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toBe(expectedResponse);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        resetPasswordDto,
      );
    });
  });

  describe('session management', () => {
    const mockUser = {
      id: '1',
      username: 'testuser',
    };

    const mockSession = {
      id: 'session-id',
      userId: '1',
    };

    describe('getSessions', () => {
      it('should return user sessions', async () => {
        const mockSessions = ['session1', 'session2'];
        mockSessionService.getUserSessions.mockResolvedValue(mockSessions);

        const result = await controller.getSessions({ user: mockUser } as any);

        expect(result).toEqual({ sessions: mockSessions });
        expect(mockSessionService.getUserSessions).toHaveBeenCalledWith(
          mockUser.id,
        );
      });
    });

    describe('terminateSession', () => {
      it('should terminate session successfully', async () => {
        mockSessionService.getSession.mockResolvedValue(mockSession);

        const result = await controller.terminateSession('session-id', {
          user: mockUser,
        } as any);

        expect(result).toEqual({ message: 'Session terminated successfully' });
        expect(mockSessionService.destroySession).toHaveBeenCalledWith(
          'session-id',
        );
      });

      it('should throw UnauthorizedException for non-existent session', async () => {
        mockSessionService.getSession.mockResolvedValue(null);

        await expect(
          controller.terminateSession('session-id', { user: mockUser } as any),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should throw UnauthorizedException for unauthorized session termination', async () => {
        mockSessionService.getSession.mockResolvedValue({
          ...mockSession,
          userId: 'different-user',
        });

        await expect(
          controller.terminateSession('session-id', { user: mockUser } as any),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('terminateAllSessions', () => {
      it('should terminate all other sessions successfully', async () => {
        const mockSessions = ['session1', 'session2', 'current-session'];
        mockSessionService.getUserSessions.mockResolvedValue(mockSessions);

        const result = await controller.terminateAllSessions(
          'current-session',
          {
            user: mockUser,
          } as any,
        );

        expect(result).toEqual({
          message: 'All other sessions terminated successfully',
        });
        expect(mockSessionService.destroySession).toHaveBeenCalledTimes(2);
        expect(mockSessionService.destroySession).not.toHaveBeenCalledWith(
          'current-session',
        );
      });
    });

    describe('getCurrentUser', () => {
      it('should return current user information', async () => {
        const mockUserWithPassword = {
          ...mockUser,
          password: 'hashed_password',
        };

        const result = await controller.getCurrentUser({
          user: mockUserWithPassword,
        } as any);

        expect(result).toEqual(mockUser);
        expect(result).not.toHaveProperty('password');
      });
    });
  });
});
