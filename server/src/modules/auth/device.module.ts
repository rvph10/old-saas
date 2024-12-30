import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/database/prisma.module';
import { DeviceService } from './services/device.service';
import { ErrorModule } from '@core/errors';
import { MonitoringModule } from '@infrastructure/monitoring/monitoring.module';

@Module({
  imports: [PrismaModule, ErrorModule, MonitoringModule],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
