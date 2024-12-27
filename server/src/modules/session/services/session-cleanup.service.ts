import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ConfigService } from '@nestjs/config';
import { MetricsService } from '@infrastructure/monitoring/metrics.service';
import { RedisService } from '@infrastructure/cache/redis.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);
  private readonly SESSION_PREFIX = 'session:';
  private readonly BATCH_SIZE = 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    try {
      this.logger.log('Starting expired session cleanup');
      const startTime = Date.now();
      let totalCleaned = 0;
      let cursor = '0';
      
      const client = this.redisService.getClient();

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          {
            MATCH: `${this.SESSION_PREFIX}*`,
            COUNT: this.BATCH_SIZE
          }
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          const expiredKeys = await this.filterExpiredKeys(keys);
          if (expiredKeys.length > 0) {
            await this.deleteExpiredSessions(expiredKeys);
            totalCleaned += expiredKeys.length;
          }
        }
      } while (cursor !== '0');

      const duration = Date.now() - startTime;
      this.recordMetrics(totalCleaned, duration);
      this.logger.log(
        `Session cleanup completed. Removed ${totalCleaned} expired sessions in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Error during session cleanup:', error.stack);
      this.metricsService.incrementCounter('session_cleanup_errors');
    }
  }

  private async filterExpiredKeys(keys: string[]): Promise<string[]> {
    const expiredKeys: string[] = [];
    for (const key of keys) {
      const ttl = await this.redisService.ttl(key);
      if (ttl <= 0) {
        expiredKeys.push(key);
      }
    }
    return expiredKeys;
  }

  private async deleteExpiredSessions(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const batchSize = 100;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(batch.map((key) => this.redisService.del(key)));
    }
  }

  private recordMetrics(totalCleaned: number, duration: number) {
    this.metricsService.incrementCounter('sessions_cleaned_total', {
      count: totalCleaned,
    });
    this.metricsService.recordHttpRequest(
      'CLEANUP',
      'sessions',
      200,
      duration / 1000,
    );
  }

  // Manual cleanup method that can be called via API if needed
  async forceCleanup(): Promise<{ cleaned: number; duration: number }> {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      const sessions = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
      const expiredKeys = await this.filterExpiredKeys(sessions);
      await this.deleteExpiredSessions(expiredKeys);
      cleaned = expiredKeys.length;
    } catch (error) {
      this.logger.error('Force cleanup failed:', error.stack);
      throw error;
    }

    const duration = Date.now() - startTime;
    return { cleaned, duration };
  }
}
