import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenService } from '../services/token.service';

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private tokenService: TokenService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTokenCleanup() {
    try {
      const deletedCount = await this.tokenService.cleanupExpiredTokens();
      this.logger.log(`Cleaned up ${deletedCount} expired tokens`);
    } catch (error) {
      this.logger.error('Token cleanup failed:', error);
    }
  }
}
