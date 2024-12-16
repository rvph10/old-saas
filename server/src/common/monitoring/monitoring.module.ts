// server/src/common/monitoring/monitoring.module.ts

import { Global, Module } from '@nestjs/common';
import { MonitoringInterceptor } from './monitor.interceptor';
import { PerformanceService } from './performance.service';
import { CustomLoggerService } from './logger.service';
import { MetricsService } from './metrics.service';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    {
      provide: MetricsService,
      useFactory: (config: ConfigService) => {
        return new MetricsService(config);
      },
      inject: [ConfigService],
    },
    MonitoringInterceptor,
    PerformanceService,
    CustomLoggerService,
    {
      provide: 'Logger',
      useClass: CustomLoggerService,
    },
  ],
  exports: [
    MetricsService,
    MonitoringInterceptor,
    PerformanceService,
    CustomLoggerService,
    'Logger',
  ],
})
export class MonitoringModule {}
