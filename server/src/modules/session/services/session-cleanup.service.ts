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

      const client = await this.redisService.getClient();

      try {
        // Get all session keys using basic pattern matching
        const keys = await client.keys(`${this.SESSION_PREFIX}*`);

        if (keys && keys.length > 0) {
          // Process in batches
          for (let i = 0; i < keys.length; i += this.BATCH_SIZE) {
            const batch = keys.slice(
              i,
              Math.min(i + this.BATCH_SIZE, keys.length),
            );
            const expiredKeys = await this.filterExpiredKeys(batch);

            if (expiredKeys.length > 0) {
              await this.deleteExpiredSessions(expiredKeys);
              totalCleaned += expiredKeys.length;
              this.logger.debug(
                `Processed batch ${i / this.BATCH_SIZE + 1}: Found ${expiredKeys.length} expired keys`,
              );
            }
          }
        } else {
          this.logger.debug('No sessions found to clean up');
        }
      } catch (error) {
        this.logger.error('Error during key retrieval:', error);
      }

      const duration = Date.now() - startTime;

      this.metricsService.incrementCounter('sessions_cleaned_total', {
        count: totalCleaned,
      });

      this.logger.log(
        `Session cleanup completed. Removed ${totalCleaned} expired sessions in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Error during session cleanup:', error.stack);
      this.metricsService.incrementCounter('session_cleanup_errors');
    }
  }

  private async filterExpiredKeys(keys: string[]): Promise<string[]> {
    if (!keys || keys.length === 0) return [];

    const client = await this.redisService.getClient();
    const expiredKeys: string[] = [];

    for (const key of keys) {
      try {
        const ttl = await client.ttl(key);
        if (ttl <= 0) {
          expiredKeys.push(key);
          this.logger.debug(`Found expired key: ${key} with TTL: ${ttl}`);
        }
      } catch (error) {
        this.logger.error(`Error checking TTL for key ${key}:`, error);
      }
    }

    return expiredKeys;
  }

  private async deleteExpiredSessions(keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) return;

    const client = await this.redisService.getClient();
    const batchSize = 100;

    for (let i = 0; i < keys.length; i += batchSize) {
      try {
        const batch = keys.slice(i, i + batchSize);
        if (batch.length > 0) {
          // Delete each key individually as pipeline might not be available
          await Promise.all(batch.map((key) => client.del(key)));
          this.logger.debug(`Deleted batch of ${batch.length} keys`);
        }
      } catch (error) {
        this.logger.error(`Error deleting batch of keys:`, error);
      }
    }
  }

  async forceCleanup(): Promise<{ cleaned: number; duration: number }> {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      const client = await this.redisService.getClient();
      const keys = await client.keys(`${this.SESSION_PREFIX}*`);

      if (keys && keys.length > 0) {
        const expiredKeys = await this.filterExpiredKeys(keys);
        await this.deleteExpiredSessions(expiredKeys);
        cleaned = expiredKeys.length;
      }
    } catch (error) {
      this.logger.error('Force cleanup failed:', error.stack);
      throw error;
    }

    const duration = Date.now() - startTime;
    return { cleaned, duration };
  }
}
