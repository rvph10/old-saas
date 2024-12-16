import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../services/session.service';
import { RedisService } from '../../../redis/redis.service';
import { DeviceService } from '../services/device.service';
import { PerformanceService } from '../../../common/monitoring/performance.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SessionService', () => {
  let sessionService: SessionService;
  let redisService: RedisService;
  let deviceService: DeviceService;
  let performanceService: PerformanceService;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
  };

  const mockDeviceService = {
    registerDevice: jest.fn(),
    getDeviceInfo: jest.fn(),
  };

  const mockPerformanceService = {
    incrementCounter: jest.fn(),
    setGauge: jest.fn(),
    measureAsync: jest.fn((name, fn) => fn()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: PerformanceService, useValue: mockPerformanceService },
      ],
    }).compile();

    sessionService = module.get<SessionService>(SessionService);
    redisService = module.get<RedisService>(RedisService);
    deviceService = module.get<DeviceService>(DeviceService);
    performanceService = module.get<PerformanceService>(PerformanceService);

    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const userId = 'test-user-id';
    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'test-browser',
    };
    const deviceId = 'test-device-id';

    beforeEach(() => {
      mockDeviceService.registerDevice.mockResolvedValue(deviceId);
    });

    it('should create a new session successfully', async () => {
      const result = await sessionService.createSession(userId, metadata);

      expect(result).toMatch(/^[0-9a-f-]{36}$/);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.stringContaining(userId),
        24 * 60 * 60,
      );

      const setCall = mockRedisService.set.mock.calls[0];
      const sessionData = JSON.parse(setCall[1]);

      expect(sessionData).toEqual(
        expect.objectContaining({
          userId,
          deviceId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          createdAt: expect.any(String),
          lastActivity: expect.any(String),
        }),
      );
    });

    it('should handle device registration failure', async () => {
      mockDeviceService.registerDevice.mockRejectedValue(
        new Error('Device registration failed'),
      );

      await expect(
        sessionService.createSession(userId, metadata),
      ).rejects.toThrow('Device registration failed');
    });
  });

  describe('getSession', () => {
    const sessionId = 'test-session-id';
    const sessionData = {
      userId: 'test-user-id',
      deviceId: 'test-device-id',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    it('should return session data and refresh if near expiry', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisService.ttl.mockResolvedValue(30 * 60);

      const result = await sessionService.getSession(sessionId);

      expect(result).toMatchObject({
        userId: sessionData.userId,
        deviceId: sessionData.deviceId,
        createdAt: expect.any(String),
        lastActivity: expect.any(String),
      });
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should return session data without refresh if not near expiry', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisService.ttl.mockResolvedValue(4 * 60 * 60);

      const result = await sessionService.getSession(sessionId);

      expect(result).toEqual(expect.objectContaining(sessionData));
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should return null for non-existent session', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await sessionService.getSession(sessionId);
      expect(result).toBeNull();
    });
  });

  describe('extendSession', () => {
    const sessionId = 'test-session-id';
    const sessionData = {
      userId: 'test-user-id',
      deviceId: 'test-device-id',
    };

    beforeEach(() => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
    });

    it('should extend session with default duration', async () => {
      await sessionService.extendSession(sessionId);

      expect(redisService.set).toHaveBeenCalledWith(
        `session:${sessionId}`,
        expect.any(String),
        24 * 60 * 60,
      );
    });

    it('should extend session with custom duration', async () => {
      const customDuration = 60 * 60;
      await sessionService.extendSession(sessionId, customDuration);

      expect(redisService.set).toHaveBeenCalledWith(
        `session:${sessionId}`,
        expect.any(String),
        customDuration,
      );
    });

    it('should reject extension with too long duration', async () => {
      const tooLongDuration = 8 * 24 * 60 * 60;

      await expect(
        sessionService.extendSession(sessionId, tooLongDuration),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject extension with too short duration', async () => {
      const tooShortDuration = 60;

      await expect(
        sessionService.extendSession(sessionId, tooShortDuration),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when session not found', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(sessionService.extendSession(sessionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revokeDeviceSessions', () => {
    const userId = 'test-user-id';
    const deviceId = 'test-device-id';

    it('should revoke all sessions for a device', async () => {
      const mockSessions = ['session1', 'session2', 'session3'];
      mockRedisService.keys.mockResolvedValue(
        mockSessions.map((s) => `session:${s}`),
      );
      mockRedisService.get.mockImplementation((key) =>
        Promise.resolve(
          JSON.stringify({
            userId,
            deviceId: key.includes('session2') ? deviceId : 'other-device',
          }),
        ),
      );

      const result = await sessionService.revokeDeviceSessions(
        userId,
        deviceId,
      );

      expect(result).toBe(1);
      expect(redisService.del).toHaveBeenCalledTimes(2);
      expect(performanceService.incrementCounter).toHaveBeenCalledWith(
        'device_sessions_revoked',
      );
    });

    it('should handle no sessions found for device', async () => {
      mockRedisService.keys.mockResolvedValue([]);

      const result = await sessionService.revokeDeviceSessions(
        userId,
        deviceId,
      );

      expect(result).toBe(0);
      expect(redisService.del).not.toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    const userId = 'test-user-id';

    it('should return all sessions for user', async () => {
      const mockSessions = ['session:1', 'session:2', 'session:3'];
      mockRedisService.keys.mockResolvedValue(mockSessions);
      mockRedisService.get.mockImplementation((key) =>
        Promise.resolve(
          JSON.stringify({
            userId: key.includes('session:2') ? 'other-user' : userId,
          }),
        ),
      );

      const result = await sessionService.getUserSessions(userId);

      expect(result).toHaveLength(2);
      expect(result).toContain('1');
      expect(result).toContain('3');
    });

    it('should handle no sessions found', async () => {
      mockRedisService.keys.mockResolvedValue([]);

      const result = await sessionService.getUserSessions(userId);

      expect(result).toEqual([]);
    });
  });

  describe('destroySession', () => {
    const sessionId = 'test-session-id';

    it('should destroy session and activity log', async () => {
      await sessionService.destroySession(sessionId);

      expect(redisService.del).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(redisService.del).toHaveBeenCalledWith(
        `session:${sessionId}:activities`,
      );
    });

    it('should handle non-existent session', async () => {
      mockRedisService.del.mockResolvedValue(0);

      await sessionService.destroySession(sessionId);

      expect(redisService.del).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions', () => {
    const userId = 'test-user-id';
    const exceptSessionId = 'current-session';

    it('should revoke all sessions except specified', async () => {
      const mockSessions = ['session1', 'session2', exceptSessionId];
      mockRedisService.keys.mockResolvedValue(
        mockSessions.map((s) => `session:${s}`),
      );
      mockRedisService.get.mockImplementation((key) =>
        Promise.resolve(JSON.stringify({ userId })),
      );

      await sessionService.revokeAllUserSessions(userId, exceptSessionId);

      expect(redisService.del).toHaveBeenCalledTimes(4);
      expect(redisService.del).not.toHaveBeenCalledWith(
        `session:${exceptSessionId}`,
      );
    });

    it('should revoke all sessions when no exception specified', async () => {
      const mockSessions = ['session1', 'session2', 'session3'];
      mockRedisService.keys.mockResolvedValue(
        mockSessions.map((s) => `session:${s}`),
      );
      mockRedisService.get.mockImplementation((key) =>
        Promise.resolve(JSON.stringify({ userId })),
      );

      await sessionService.revokeAllUserSessions(userId);

      // We expect 6 calls: 3 sessions × 2 deletions each (session + activity log)
      expect(redisService.del).toHaveBeenCalledTimes(6);
    });
  });
});
