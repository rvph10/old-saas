import { RedisModule } from '@infrastructure/cache/redis.module';
import { MailModule } from '@modules/mail/mail.module';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DeviceModule } from './device.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './controllers';
import {
  AuthService,
  CookieConfigService,
  CsrfService,
  DeviceService,
  LocationService,
  PasswordService,
  TokenService,
  TwoFactorService,
} from './services';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '@core/database/prisma.service';
import { SessionService } from '@modules/session/services';
import { PerformanceService } from '@infrastructure/monitoring/performance.service';
import { TokenCleanupTask } from './tasks/token-cleanup.task';
import { CsrfMiddleware } from '@core/middleware/csrf.middleware';
import { SessionModule } from '@modules/session/session.module';
import { ErrorHandlingService, ErrorModule } from '@core/errors';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    RedisModule,
    MailModule,
    DeviceModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        issuer: 'nibblix.com',
        audience: 'nibblix-clients',
      },
    }),
    forwardRef(() => SessionModule),
    ErrorModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    SessionService,
    PerformanceService,
    DeviceService,
    LocationService,
    TwoFactorService,
    PasswordService,
    TokenService,
    TokenCleanupTask,
    CookieConfigService,
    CsrfService,
    ErrorHandlingService,
  ],
  exports: [
    AuthService,
    SessionService,
    DeviceService,
    PasswordService,
    TokenService,
    CsrfService,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/verify-email', method: RequestMethod.POST },
        { path: 'auth/resend-verification', method: RequestMethod.POST },
        { path: 'auth/password-reset/request', method: RequestMethod.POST },
        { path: 'auth/csrf-token', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
