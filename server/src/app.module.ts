import {
  ClassSerializerInterceptor,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import configuration from './config/configuration';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/module/auth.module';
import { SessionMiddleware } from './modules/auth/middleware/session.middleware';
import { RateLimitMiddleware } from './modules/auth/middleware/rate-limit.middleware';
import { RedisModule } from './redis/redis.module';
import { PrismaService } from './prisma/prisma.service';
import { MiddlewareModule } from './modules/middleware/middleware.module';
import { HealthController } from './health/health.controller';
import { MailModule } from './modules/mail/mail.module';
import { ErrorHandlingService } from './common/errors/error-handling.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { MetricsService } from './common/monitoring/metrics.service';
import { HealthModule } from './health/health.module';
import { ErrorModule } from './common/errors/error.module';
import { RequestSanitizerMiddleware } from './common/security/request-sanitizer.middleware';
import * as cookieParser from 'cookie-parser';
import { RefreshTokenMiddleware } from './modules/auth/middleware/refresh-token.middleware';

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
    consumer.apply(RequestSanitizerMiddleware).forRoutes('*');
    consumer.apply(RefreshTokenMiddleware).forRoutes('*');
    consumer.apply(cookieParser(process.env.COOKIE_SECRET)).forRoutes('*');
    consumer
      .apply(RateLimitMiddleware)
      .exclude('health', 'public', {
        path: 'metrics',
        method: RequestMethod.GET,
      })
      .forRoutes('*');

    consumer
      .apply(RateLimitMiddleware)
      .exclude('health', 'public')
      .forRoutes('*');

    consumer.apply(SessionMiddleware).forRoutes('auth/*');
  }
}
