import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthCheckResult, HealthStatus, MemoryHealthCheck } from './types';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      memory: this.checkMemory(),
      uptime: process.uptime(),
    };

    return {
      status: this.determineOverallStatus(checks),
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private determineOverallStatus(checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    memory: MemoryHealthCheck;
    uptime: number;
  }): 'ok' | 'error' {
    const statuses = [checks.database, checks.redis, checks.memory];
    return statuses.every((check) => check.status === 'ok') ? 'ok' : 'error';
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Database health check failed', error.stack);
      return { status: 'error', error: error.message };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult> {
    try {
      await this.redis.set('health-check', 'ok', 10);
      await this.redis.get('health-check');
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Redis health check failed', error.stack);
      return { status: 'error', error: error.message };
    }
  }

  private checkMemory(): MemoryHealthCheck {
    const used = process.memoryUsage();
    return {
      status: 'ok',
      heap: Math.round(used.heapUsed / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
    };
  }
}
