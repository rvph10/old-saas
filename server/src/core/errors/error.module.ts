import { Global, Module } from '@nestjs/common';
import { ErrorHandlingService } from './error-handling.service';
import { MetricsService } from '../monitoring/metrics.service';

@Global()
@Module({
  providers: [ErrorHandlingService, MetricsService],
  exports: [ErrorHandlingService],
})
export class ErrorModule {}
