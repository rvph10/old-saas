import { Global, Module } from '@nestjs/common';
import { MonitoringInterceptor } from './monitor.interceptor';
import { PerformanceService } from './performance.service';
import { CustomLoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    MonitoringInterceptor,
    PerformanceService,
    CustomLoggerService,
    {
      provide: 'Logger',
      useClass: CustomLoggerService,
    },
  ],
  exports: [
    MonitoringInterceptor,
    PerformanceService,
    CustomLoggerService,
    'Logger',
  ],
})
export class MonitoringModule {}
