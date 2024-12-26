import { Module } from '@nestjs/common';
import { SessionCleanupService } from './services/session-cleanup.service';
import { SessionController } from './session.controller';
import { RedisModule } from '@infrastructure/cache/redis.module';
import { MonitoringModule } from '@infrastructure/monitoring/monitoring.module';

@Module({
  imports: [RedisModule, MonitoringModule],
  providers: [SessionCleanupService],
  controllers: [SessionController],
  exports: [SessionCleanupService],
})
export class SessionModule {}