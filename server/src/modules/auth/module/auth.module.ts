import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    RedisModule,
    MailModule,
    DeviceModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
        issuer: 'nibblix.com',
        audience: 'nibblix-clients',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    SessionService,
    PerformanceService,
    DeviceService,
  ],
  exports: [AuthService, SessionService, DeviceService],
})
export class AuthModule {}
