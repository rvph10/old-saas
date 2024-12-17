import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { RedisService } from '../../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    ttl: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRequest = {
    ip: '127.0.0.1',
    path: '/auth/login',
    user: null,
  };

  const mockResponse = {
    setHeader: jest.fn(),
  };

  const mockNext = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitMiddleware,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    middleware = module.get<RateLimitMiddleware>(RateLimitMiddleware);

    // Reset all mocks
    jest.clearAllMocks();

    // Set default mock implementations
    mockRedisService.ttl.mockResolvedValue(300); // 5 minutes in seconds
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests within rate limit', async () => {
    mockRedisService.get.mockResolvedValue('1');
    mockRedisService.ttl.mockResolvedValue(300);

    await middleware.use(mockRequest as any, mockResponse as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Limit',
      expect.any(Number),
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      expect.any(Number),
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    );
  });

  it('should block requests exceeding rate limit', async () => {
    mockRedisService.get.mockResolvedValue('6');
    mockRedisService.ttl.mockResolvedValue(300);

    await expect(
      middleware.use(mockRequest as any, mockResponse as any, mockNext),
    ).rejects.toThrow(HttpException);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle authenticated users', async () => {
    const authenticatedReq = {
      ...mockRequest,
      user: { id: 'user123' },
    };

    // Mock for IP check and user check
    mockRedisService.get
      .mockResolvedValueOnce('1') // First call for IP-based check
      .mockResolvedValueOnce('1'); // Second call for user-based check

    mockRedisService.ttl.mockResolvedValue(300);

    await middleware.use(
      authenticatedReq as any,
      mockResponse as any,
      mockNext,
    );

    // Verify Redis get was called exactly twice
    expect(mockRedisService.get).toHaveBeenCalledWith(
      expect.stringContaining('rateLimit:127.0.0.1'),
    ); // IP check
    expect(mockRedisService.get).toHaveBeenCalledWith(
      expect.stringContaining('rateLimit:user:user123'),
    ); // User check
    expect(mockRedisService.get).toHaveBeenCalledTimes(2);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle new requests correctly', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.ttl.mockResolvedValue(300);

    await middleware.use(mockRequest as any, mockResponse as any, mockNext);

    expect(mockRedisService.set).toHaveBeenCalledWith(
      expect.stringContaining('rateLimit:'),
      '1',
      expect.any(Number),
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle Redis errors gracefully', async () => {
    mockRedisService.get.mockRejectedValue(new Error('Redis error'));
    mockRedisService.ttl.mockResolvedValue(300);

    await expect(
      middleware.use(mockRequest as any, mockResponse as any, mockNext),
    ).rejects.toThrow(HttpException);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should properly increment counters', async () => {
    mockRedisService.get.mockResolvedValue('1');
    mockRedisService.ttl.mockResolvedValue(300);

    await middleware.use(mockRequest as any, mockResponse as any, mockNext);

    expect(mockRedisService.set).toHaveBeenCalledWith(
      expect.any(String),
      '2',
      expect.any(Number),
    );
    expect(mockNext).toHaveBeenCalled();
  });
});
