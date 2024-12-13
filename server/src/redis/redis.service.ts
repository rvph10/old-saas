import { Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async get(key: string): Promise<any> {
    return this.cacheManager.get(key);
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl * 1000);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async ttl(key: string): Promise<number> {
    const client = (this.cacheManager.store as any).getClient();
    return client.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const client = (this.cacheManager.store as any).getClient();
    return client.keys(pattern);
  }
}
