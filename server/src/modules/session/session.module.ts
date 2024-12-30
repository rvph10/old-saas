import { Module } from '@nestjs/common';
import { SessionCleanupService } from './services/session-cleanup.service';
import { SessionController } from './session.controller';
import { RedisModule } from '@infrastructure/cache/redis.module';
import { MonitoringModule } from '@infrastructure/monitoring/monitoring.module';
import { DeviceModule } from '@modules/auth/device.module';
import { SessionService } from './services';
import { ConfigModule } from '@nestjs/config';
import { ErrorModule } from '@core/errors';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    MonitoringModule,
    DeviceModule,
    ErrorModule,
  ],
  providers: [SessionService, SessionCleanupService],
  controllers: [SessionController],
  exports: [SessionService, SessionCleanupService],
})
export class SessionModule {}
