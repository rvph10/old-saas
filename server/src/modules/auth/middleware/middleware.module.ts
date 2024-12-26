import { Module } from '@nestjs/common';
import { SessionMiddleware } from './session.middleware';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { SessionService } from '../../session/services/session.service';
import { RedisModule } from '@infrastructure/cache/redis.module';
import { DeviceModule } from '../device.module';
import { ErrorHandlingService, ErrorModule } from '@core/errors';
import { MonitoringModule } from '@infrastructure/monitoring/monitoring.module';
import { ConfigModule } from '@nestjs/config';
import { MetricsService } from '@infrastructure/monitoring/metrics.service';
import { SessionModule } from '@modules/session/session.module';


@Module({
  imports: [
    RedisModule,
    DeviceModule,
    ErrorModule,
    MonitoringModule,
    ConfigModule,
    SessionModule
  ],
  providers: [
    SessionMiddleware,
    RateLimitMiddleware,
    RequestLoggerMiddleware,
    SessionService,
    ErrorHandlingService,
    MetricsService
  ],
  exports: [
    SessionMiddleware,
    RateLimitMiddleware,
    RequestLoggerMiddleware
  ],
})
export class MiddlewareModule {}
