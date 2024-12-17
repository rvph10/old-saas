import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from 'src/redis/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  private readonly defaultLimits = {
    'auth/login': { limit: 5, windowSize: 300 },
    'auth/register': { limit: 3, windowSize: 3600 },
    'auth/password-reset': { limit: 3, windowSize: 3600 },
    default: { limit: 100, windowSize: 900 },
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private async getRateLimitData(
    key: string,
  ): Promise<{ count: number; ttl: number }> {
    const current = await this.redisService.get(key);
    const ttl = await this.redisService.ttl(key);
    return {
      count: current ? parseInt(current) : 0,
      ttl: ttl,
    };
  }

  private getLimitConfig(path: string): { limit: number; windowSize: number } {
    for (const [pattern, config] of Object.entries(this.defaultLimits)) {
      if (path.includes(pattern)) {
        return config;
      }
    }
    return this.defaultLimits.default;
  }

  private async checkRateLimit(
    key: string,
    config: { limit: number; windowSize: number },
    rateLimitData?: { count: number; ttl: number },
  ): Promise<{ count: number; ttl: number }> {
    const data = rateLimitData || (await this.getRateLimitData(key));
    const { count, ttl } = data;

    if (count >= config.limit) {
      const resetTime = new Date(
        Date.now() + Math.max(0, ttl) * 1000,
      ).toISOString();
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again after ${resetTime}`,
          resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (count === 0) {
      await this.redisService.set(key, '1', config.windowSize);
      return { count: 1, ttl: config.windowSize };
    } else {
      const newTtl = Math.max(1, ttl);
      await this.redisService.set(key, (count + 1).toString(), newTtl);
      return { count: count + 1, ttl: newTtl };
    }
  }

  private async addRateLimitHeaders(
    res: Response,
    key: string,
    config: { limit: number; windowSize: number },
    rateLimitData: { count: number; ttl: number },
  ): Promise<void> {
    try {
      const resetTime = new Date(
        Date.now() +
          (Number.isFinite(rateLimitData.ttl) && rateLimitData.ttl > 0
            ? rateLimitData.ttl
            : config.windowSize) *
            1000,
      );

      res.setHeader('X-RateLimit-Limit', config.limit);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, config.limit - rateLimitData.count),
      );
      res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
    } catch (error) {
      this.logger.error(`Error setting rate limit headers: ${error.message}`);
    }
  }

  private async getCurrentCount(key: string): Promise<number> {
    const current = await this.redisService.get(key);
    return current ? parseInt(current) : 0;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip;
      const path = req.path.toLowerCase();
      const userId = (req as any).user?.id;

      const config = this.getLimitConfig(path);

      const ipKey = `rateLimit:${ip}:${path}`;
      const userKey = userId ? `rateLimit:user:${userId}:${path}` : null;

      // Check IP-based rate limit
      const ipLimitData = await this.checkRateLimit(ipKey, config);

      // Check user-based rate limit if authenticated
      if (userKey) {
        await this.checkRateLimit(userKey, config);
      }

      // Add rate limit headers based on IP limit
      await this.addRateLimitHeaders(res, ipKey, config, ipLimitData);

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Rate limit error: ${error.message}`, error.stack);
      throw new HttpException(
        'Rate limit error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
