import { Global, Module } from '@nestjs/common';
import { ErrorHandlingService } from './error-handling.service';
import { MetricsService } from '@infrastructure/monitoring/metrics.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ErrorHandlingService, MetricsService, ConfigService],
  exports: [ErrorHandlingService, MetricsService],
})
export class ErrorModule {}
