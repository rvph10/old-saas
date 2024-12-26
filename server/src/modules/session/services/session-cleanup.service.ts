import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';

import { ConfigService } from '@nestjs/config';
import { MetricsService } from 'src/common/monitoring/metrics.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);
  private readonly SESSION_PREFIX = 'session:';
  private readonly BATCH_SIZE = 1000; // Process sessions in batches

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
      let lastKey = '0'; // Redis cursor for scanning

      do {
        const [cursor, keys] = await this.scanSessions(lastKey, this.BATCH_SIZE);
        lastKey = cursor;

        if (keys.length > 0) {
          const expiredKeys = await this.filterExpiredKeys(keys);
          if (expiredKeys.length > 0) {
            await this.deleteExpiredSessions(expiredKeys);
            totalCleaned += expiredKeys.length;
          }
        }

        // Break if we've processed all keys
        if (cursor === '0') break;
      } while (true);

      const duration = Date.now() - startTime;
      this.recordMetrics(totalCleaned, duration);
      this.logger.log(`Session cleanup completed. Removed ${totalCleaned} expired sessions in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error during session cleanup:', error.stack);
      this.metricsService.incrementCounter('session_cleanup_errors');
    }
  }

  private async scanSessions(cursor: string, count: number): Promise<[string, string[]]> {
    const client = this.redisService.getClient();
    const [nextCursor, keys] = await client.scan(cursor, {
      MATCH: `${this.SESSION_PREFIX}*`,
      COUNT: count
    });
    return [nextCursor, keys];
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

    // Delete in batches to avoid blocking Redis
    const batchSize = 100;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(batch.map(key => this.redisService.del(key)));
    }
  }

  private recordMetrics(totalCleaned: number, duration: number) {
    this.metricsService.incrementCounter('sessions_cleaned_total', { count: totalCleaned });
    this.metricsService.recordHttpRequest(
      'CLEANUP',
      'sessions',
      200,
      duration / 1000
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