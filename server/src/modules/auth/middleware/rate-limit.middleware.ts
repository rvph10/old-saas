import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip;
    const key = `rateLimit:${ip}`;
    const limit = 100;
    const window = 60 * 15;

    const current = await this.redisService.get(key);
    
    if (!current) {
      await this.redisService.set(key, '1', window);
      next();
      return;
    }

    const count = parseInt(current);
    if (count > limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.redisService.set(key, (count + 1).toString(), window);
    next();
  }
}