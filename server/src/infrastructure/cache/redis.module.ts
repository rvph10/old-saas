import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const config = {
          store: redisStore as any,
          url: configService.get('REDIS_URL') || 'redis://redis:6379',
          isGlobal: true,
          ttl: 60 * 60 * 24, // 24 hours
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
        };
        return config;
      },
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
