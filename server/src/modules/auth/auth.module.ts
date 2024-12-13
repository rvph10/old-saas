import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisModule } from 'src/redis/redis.module';
import { SessionService } from './session.service';
import { SessionMiddleware } from './middleware/session.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';


@Module({
  imports: [
    RedisModule,
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
    SessionService
  ],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
