import { Controller, Get, Logger } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  check() {
    this.logger.debug('Health check endpoint hit');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
