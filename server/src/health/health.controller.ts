import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthStatus } from './types';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private healthService: HealthService) {}

  @Get()
  async check(): Promise<
    HealthStatus | { status: 'error'; error: string; timestamp: string }
  > {
    try {
      const healthCheck = await this.healthService.checkHealth();
      return healthCheck;
    } catch (error) {
      this.logger.error('Health check failed', error.stack);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
