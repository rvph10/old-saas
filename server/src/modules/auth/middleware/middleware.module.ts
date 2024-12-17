import { Module } from '@nestjs/common';
import { RedisModule } from 'src/redis/redis.module';
import { DeviceModule } from '../module/device.module';
import { MonitoringModule } from 'src/common/monitoring/monitoring.module';
import { ErrorModule } from 'src/common/errors/error.module';
import { SessionMiddleware } from './session.middleware';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { SessionService } from '../services/session.service';

@Module({
  imports: [RedisModule, DeviceModule, ErrorModule, MonitoringModule],
  providers: [
    SessionMiddleware,
    RateLimitMiddleware,
    RequestLoggerMiddleware,
    SessionService,
  ],
  exports: [SessionMiddleware, RateLimitMiddleware, RequestLoggerMiddleware],
})
export class MiddlewareModule {}
