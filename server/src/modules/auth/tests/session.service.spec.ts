import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../session.service';
import { RedisService } from 'src/redis/redis.service';

describe('SessionService', () => {
  let sessionService: SessionService;
  let redisService: RedisService;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
  };

  jest.mock('@nestjs/common', () => ({
    ...jest.requireActual('@nestjs/common'),
    Logger: jest.fn().mockImplementation(() => ({
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    sessionService = module.get<SessionService>(SessionService);
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const userId = 'test-user-id';
    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should create a new session', async () => {
      const sessionData = {
        userId,
        createdAt: expect.any(String),
        lastActivity: expect.any(String),
        ...metadata,
      };

      await sessionService.createSession(userId, metadata);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.stringContaining(userId),
        24 * 60 * 60,
      );

      const setCall = (redisService.set as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(setCall[1]);
      expect(savedData).toMatchObject(sessionData);
    });
  });

  describe('getSession', () => {
    const sessionId = 'test-session-id';
    const sessionData = {
      userId: 'test-user-id',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    it('should return session data and refresh if close to expiry', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisService.ttl.mockResolvedValue(30 * 60);
      const result = await sessionService.getSession(sessionId);
      expect(result).toEqual({
        userId: sessionData.userId,
        createdAt: expect.any(String),
        lastActivity: expect.any(String),
      });

      expect(new Date(result.createdAt).getTime()).not.toBeNaN();
      expect(new Date(result.lastActivity).getTime()).not.toBeNaN();
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should return null for non-existent session', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await sessionService.getSession(sessionId);
      expect(result).toBeNull();
    });

    it('should return session data without refresh if not close to expiry', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisService.ttl.mockResolvedValue(2 * 60 * 60);

      const result = await sessionService.getSession(sessionId);

      expect(result).toEqual({
        userId: sessionData.userId,
        createdAt: expect.any(String),
        lastActivity: expect.any(String),
      });

      expect(new Date(result.createdAt).getTime()).not.toBeNaN();
      expect(new Date(result.lastActivity).getTime()).not.toBeNaN();
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('validateSession', () => {
    const sessionId = 'test-session-id';
    const userId = 'test-user-id';

    it('should return true for valid session', async () => {
      const sessionData = { userId };
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisService.ttl.mockResolvedValue(2 * 60 * 60);

      const result = await sessionService.validateSession(sessionId, userId);
      expect(result).toBe(true);
    });

    it('should return false for invalid session', async () => {
      const sessionData = { userId: 'different-user' };
      mockRedisService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockRedisService.ttl.mockResolvedValue(2 * 60 * 60);

      const result = await sessionService.validateSession(sessionId, userId);
      expect(result).toBe(false);
    });
  });

  describe('destroySession', () => {
    it('should delete the session', async () => {
      const sessionId = 'test-session-id';
      await sessionService.destroySession(sessionId);

      expect(redisService.del).toHaveBeenCalledWith(
        expect.stringContaining(sessionId),
      );
    });
  });

  describe('getUserSessions', () => {
    const userId = 'test-user-id';

    it('should return all sessions for user', async () => {
      const mockSessions = ['session:1', 'session:2', 'session:3'];

      const mockSessionData = {
        'session:1': JSON.stringify({ userId }),
        'session:2': JSON.stringify({ userId: 'other-user' }),
        'session:3': JSON.stringify({ userId }),
      };

      mockRedisService.keys.mockResolvedValue(mockSessions);
      mockRedisService.get.mockImplementation((key) =>
        Promise.resolve(mockSessionData[key]),
      );

      const result = await sessionService.getUserSessions(userId);

      expect(result).toHaveLength(2);
      expect(result).toContain('1');
      expect(result).toContain('3');
    });
  });
});
