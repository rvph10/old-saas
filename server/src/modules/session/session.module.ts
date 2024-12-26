import { Module } from '@nestjs/common';
import { SessionCleanupService } from './services/session-cleanup.service';
import { SessionController } from './session.controller';
import { RedisModule } from '../../redis/redis.module';
import { MonitoringModule } from '../../common/monitoring/monitoring.module';

@Module({
  imports: [RedisModule, MonitoringModule],
  providers: [SessionCleanupService],
  controllers: [SessionController],
  exports: [SessionCleanupService],
})
export class SessionModule {}