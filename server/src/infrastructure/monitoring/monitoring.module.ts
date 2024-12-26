import { Global, Module } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { MetricsService } from './metrics.service';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '@infrastructure/logger/logger.service';

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
    PerformanceService,
    CustomLoggerService,
    {
      provide: 'Logger',
      useClass: CustomLoggerService,
    },
  ],
  exports: [MetricsService, PerformanceService, CustomLoggerService, 'Logger'],
})
export class MonitoringModule {}
