import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import configuration from './config/configuration';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { SessionMiddleware } from './modules/auth/middleware/session.middleware';
import { RateLimitMiddleware } from './modules/auth/middleware/rate-limit.middleware';
import { RequestLoggerMiddleware } from './modules/auth/middleware/request-logger.middleware';
import { RedisModule } from './redis/redis.module';
import { PrismaService } from './prisma/prisma.service';
import { MiddlewareModule } from './modules/middleware/middleware.module';
import { HealthController } from './health/health.controller';
import { MailModule } from './modules/mail/mail.module';
import { ErrorHandlingService } from './common/errors/error-handling.service';
import { SecurityHeadersMiddleware } from './common/security/security-headers.middleware';
import { MonitoringInterceptor } from './common/monitoring/monitor.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { MetricsService } from './common/monitoring/metrics.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrismaModule,
    AuthModule,
    RedisModule,
    MiddlewareModule,
    MailModule,
    MonitoringModule,
    AuthModule,
    HealthModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    ErrorHandlingService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityHeadersMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');

    consumer
      .apply(RateLimitMiddleware)
      .exclude('health', 'public')
      .forRoutes('*');

    consumer.apply(SessionMiddleware).forRoutes('auth/*');
  }
}
