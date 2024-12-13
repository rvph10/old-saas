import { Module } from '@nestjs/common';
import { SessionMiddleware } from '../auth/middleware/session.middleware';
import { RateLimitMiddleware } from '../auth/middleware/rate-limit.middleware';
import { RequestLoggerMiddleware } from '../auth/middleware/request-logger.middleware';
import { SessionService } from '../auth/session.service';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    SessionMiddleware,
    RateLimitMiddleware,
    RequestLoggerMiddleware,
    SessionService,
  ],
  exports: [SessionMiddleware, RateLimitMiddleware, RequestLoggerMiddleware],
})
export class MiddlewareModule {}
