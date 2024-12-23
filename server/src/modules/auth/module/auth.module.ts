import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from '../auth.controller';
import { AuthService } from '../services/auth.service';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisModule } from 'src/redis/redis.module';
import { SessionService } from '../services/session.service';
import { MailModule } from '../../mail/mail.module';
import { PerformanceService } from 'src/common/monitoring/performance.service';
import { DeviceService } from '../services/device.service';
import { DeviceModule } from './device.module';
import { TwoFactorService } from '../services/two-factor.service';
import { LocationService } from '../services/location.service';
import { PasswordService } from '../services/password.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenCleanupTask } from '../tasks/token-cleanup.task';
import { TokenService } from '../services/token.service';
import { CookieConfigService } from '../services/cookie-config.service';
import { CsrfService } from '../services/csrf.service';
import { CsrfMiddleware } from 'src/common/middleware/csrf.middleware';

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
    CsrfService
  ],
  exports: [
    AuthService,
    SessionService,
    DeviceService,
    PasswordService,
    TokenService,
    CsrfService
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/csrf-token', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}