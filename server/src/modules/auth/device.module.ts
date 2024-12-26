import { Module } from '@nestjs/common';
import { DeviceService } from '../services/device.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
