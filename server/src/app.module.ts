import {
  ClassSerializerInterceptor,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SessionMiddleware } from './modules/auth/middleware/session.middleware';
import { RateLimitMiddleware } from './modules/auth/middleware/rate-limit.middleware';
import { PrismaService } from './core/database/prisma.service';
import { MailModule } from './modules/mail/mail.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { RefreshTokenMiddleware } from './modules/auth/middleware/refresh-token.middleware';
import { SessionModule } from './modules/session/session.module';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from '@core/config/configuration';
import { AuthModule } from '@modules/auth/auth.module';
import { RedisModule } from '@infrastructure/cache/redis.module';
import { MonitoringModule } from '@infrastructure/monitoring/monitoring.module';
import { MetricsService } from '@infrastructure/monitoring/metrics.service';
import { RequestSanitizerMiddleware } from '@core/security/request-sanitizer.middleware';
import { PrismaModule } from '@core/database/prisma.module';
import { MiddlewareModule } from '@modules/auth/middleware/middleware.module';
import { HealthModule } from '@modules/health/health.module';
import { ErrorHandlingService, ErrorModule } from '@core/errors';
import { HealthController } from '@modules/health/health.controller';
import { CsrfMiddleware } from '@core/middleware/csrf.middleware';

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
    ErrorModule,
    SessionModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    ErrorHandlingService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. Cookie Parser middleware
    consumer.apply(cookieParser(process.env.COOKIE_SECRET)).forRoutes('*');

    // 2. Security middleware
    consumer.apply(RequestSanitizerMiddleware).forRoutes('*');

    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/password-reset/(.*)', method: RequestMethod.ALL },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/verify-email', method: RequestMethod.POST },
        { path: 'auth/verify', method: RequestMethod.POST },
        { path: 'auth/resend-verification', method: RequestMethod.POST },
        { path: 'auth/csrf-token', method: RequestMethod.GET },
      )
      .forRoutes('*');

    // 3. Refresh token middleware with proper exclusions
    consumer
      .apply(RefreshTokenMiddleware)
      .exclude(
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/password-reset/request', method: RequestMethod.POST },
        { path: 'auth/password-reset/reset', method: RequestMethod.POST },
        { path: 'auth/verify-email', method: RequestMethod.POST },
      )
      .forRoutes('*');

    // 4. Rate limiting middleware
    consumer
      .apply(RateLimitMiddleware)
      .exclude('health', 'public', {
        path: 'metrics',
        method: RequestMethod.GET,
      })
      .forRoutes('*');

    // 5. Session middleware only for auth routes
    consumer
      .apply(SessionMiddleware)
      .exclude(
        { path: 'auth/password-reset/(.*)', method: RequestMethod.ALL },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/verify-email', method: RequestMethod.POST },
      )
      .forRoutes('auth/*');
  }
}
