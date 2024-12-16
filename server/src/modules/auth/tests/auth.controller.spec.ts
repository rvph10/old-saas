import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PerformanceService } from 'src/common/monitoring/performance.service';
import { DeviceService } from '../services/device.service';
import { TwoFactorService } from '../services/two-factor.service';
import { LocationService } from '../services/location.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let sessionService: SessionService;
  let deviceService: DeviceService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    blockAccount: jest.fn(),
    logoutAllDevices: jest.fn(),
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

  const mockSessionService = {
    getSession: jest.fn(),
    destroySession: jest.fn(),
    getUserSessions: jest.fn(),
    extendSession: jest.fn(),
    revokeDeviceSessions: jest.fn(),
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

  const mockDeviceService = {
    getUserDevices: jest.fn(),
    setDeviceTrusted: jest.fn(),
    removeDevice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: PerformanceService, useValue: mockPerformanceService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: LocationService, useValue: mockLocationService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    sessionService = module.get<SessionService>(SessionService);
    deviceService = module.get<DeviceService>(DeviceService);

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

  describe('device management', () => {
    const mockUser = { id: '1', username: 'testuser' };

    describe('getUserDevices', () => {
      it('should return user devices', async () => {
        const mockDevices = [
          { id: '1', name: 'Device 1' },
          { id: '2', name: 'Device 2' },
        ];
        mockDeviceService.getUserDevices.mockResolvedValue(mockDevices);

        const result = await controller.getUserDevices({
          user: mockUser,
        } as any);
        expect(result).toEqual(mockDevices);
        expect(mockDeviceService.getUserDevices).toHaveBeenCalledWith(
          mockUser.id,
        );
      });
    });

    describe('trustDevice', () => {
      it('should trust device successfully', async () => {
        const deviceId = 'device-1';
        await controller.trustDevice(deviceId, { user: mockUser } as any);
        expect(mockDeviceService.setDeviceTrusted).toHaveBeenCalledWith(
          deviceId,
          mockUser.id,
          true,
        );
      });
    });

    describe('removeDevice', () => {
      it('should remove device successfully', async () => {
        const deviceId = 'device-1';
        const currentSessionId = 'current-session';
        mockSessionService.getSession.mockResolvedValue({
          deviceId: 'different-device',
        });
        mockDeviceService.removeDevice.mockResolvedValue({ count: 1 });
        mockSessionService.revokeDeviceSessions.mockResolvedValue(2);

        const result = await controller.removeDevice(
          deviceId,
          currentSessionId,
          { user: mockUser } as any,
        );

        expect(result).toEqual({
          message: 'Device removed successfully',
          sessionsRevoked: 2,
        });
      });

      it('should prevent removing current device', async () => {
        const deviceId = 'device-1';
        const currentSessionId = 'current-session';
        mockSessionService.getSession.mockResolvedValue({
          deviceId: deviceId,
        });

        await expect(
          controller.removeDevice(deviceId, currentSessionId, {
            user: mockUser,
          } as any),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('session management', () => {
    const mockUser = { id: '1', username: 'testuser' };

    describe('extendUserSession', () => {
      it('should extend session successfully', async () => {
        const sessionId = 'test-session';
        const duration = 3600;

        await controller.extendUserSession(sessionId, { duration });

        expect(mockSessionService.extendSession).toHaveBeenCalledWith(
          sessionId,
          duration,
        );
      });
    });

    describe('terminateAllSessions', () => {
      it('should terminate all sessions except current', async () => {
        const currentSessionId = 'current-session';
        mockAuthService.logoutAllDevices.mockResolvedValue({
          message: 'Logged out from all other devices',
          sessionsTerminated: 2,
        });

        const result = await controller.terminateAllSessions(
          currentSessionId,
          { user: mockUser } as any,
          { keepCurrentSession: true },
        );

        expect(result.message).toBe('Logged out from all other devices');
        expect(mockAuthService.logoutAllDevices).toHaveBeenCalledWith(
          mockUser.id,
          currentSessionId,
        );
      });
    });
  });

  describe('email verification', () => {
    it('should verify email successfully', async () => {
      const verifyEmailDto = { token: 'valid-token' };
      mockAuthService.verifyEmail.mockResolvedValue({
        message: 'Email verified successfully',
      });

      const result = await controller.verifyEmail(verifyEmailDto);
      expect(result.message).toBe('Email verified successfully');
    });

    it('should resend verification email', async () => {
      const resendDto = { email: 'test@example.com' };
      mockAuthService.resendVerificationEmail.mockResolvedValue({
        message: 'Verification email sent',
      });

      const result = await controller.resendVerification(resendDto);
      expect(result.message).toBe('Verification email sent');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user data without password', async () => {
      const mockUserWithPassword = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
      };

      const result = await controller.getCurrentUser({
        user: mockUserWithPassword,
      } as any);

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      });
    });
  });

  describe('metrics', () => {
    it('should return performance metrics', async () => {
      const result = await controller.getMetrics();
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('timestamp');
      expect(mockPerformanceService.getMetricsSummary).toHaveBeenCalled();
    });
  });

  describe('2FA', () => {
    const mockUser = { id: '1', username: 'testuser' };

    beforeEach(() => {
      // Add TwoFactorService to providers in the TestingModule setup
    });

    describe('setup2FA', () => {
      it('should generate 2FA secret', async () => {
        const mockSecret = {
          secret: 'SECRET',
          qrCode: 'QR_CODE_URL',
        };
        mockTwoFactorService.generateSecret.mockResolvedValue(mockSecret);

        const result = await controller.setup2FA({ user: mockUser } as any);
        expect(result).toEqual(mockSecret);
      });
    });

    describe('enable2FA', () => {
      it('should enable 2FA with valid token', async () => {
        mockTwoFactorService.verifyToken.mockResolvedValue(true);

        const result = await controller.enable2FA({ user: mockUser } as any, {
          token: '123456',
        });

        expect(result.message).toBe('2FA enabled successfully');
      });

      it('should reject invalid token', async () => {
        mockTwoFactorService.verifyToken.mockResolvedValue(false);

        await expect(
          controller.enable2FA({ user: mockUser } as any, { token: '123456' }),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('verify2FA', () => {
      it('should verify valid 2FA token', async () => {
        mockTwoFactorService.verifyToken.mockResolvedValue(true);

        const result = await controller.verify2FA({ user: mockUser } as any, {
          token: '123456',
        });

        expect(result.message).toBe('2FA verification successful');
      });

      it('should reject invalid 2FA token', async () => {
        mockTwoFactorService.verifyToken.mockResolvedValue(false);

        await expect(
          controller.verify2FA({ user: mockUser } as any, { token: '123456' }),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('disable2FA', () => {
      it('should disable 2FA', async () => {
        const result = await controller.disable2FA({ user: mockUser } as any);
        expect(result.message).toBe('2FA disabled successfully');
        expect(mockTwoFactorService.disable2FA).toHaveBeenCalledWith(
          mockUser.id,
        );
      });
    });
  });
});
