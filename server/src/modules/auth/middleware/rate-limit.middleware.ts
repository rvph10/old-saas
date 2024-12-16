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
    'default': { limit: 100, windowSize: 900 },
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip;
      const path = req.path.toLowerCase();
      const userId = (req as any).user?.id;

      const config = this.getLimitConfig(path);

      const ipKey = `rateLimit:${ip}:${path}`;
      const userKey = userId ? `rateLimit:user:${userId}:${path}` : null;

      await this.checkRateLimit(ipKey, config);
      if (userKey) {
        await this.checkRateLimit(userKey, config);
      }

      this.addRateLimitHeaders(res, ipKey, config);

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
  ): Promise<void> {
    const current = await this.redisService.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= config.limit) {
      const ttl = await this.redisService.ttl(key);
      const resetTime = new Date(Date.now() + ttl * 1000).toISOString();

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
    } else {
      await this.redisService.set(
        key,
        (count + 1).toString(),
        await this.redisService.ttl(key),
      );
    }
  }

  private async addRateLimitHeaders(
    res: Response,
    key: string,
    config: { limit: number; windowSize: number },
  ): Promise<void> {
    const current = await this.redisService.get(key);
    const count = current ? parseInt(current) : 0;
    const ttl = await this.redisService.ttl(key);

    res.setHeader('X-RateLimit-Limit', config.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.limit - count));
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());
  }
}