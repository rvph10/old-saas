import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailerService } from './services/mail.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailModule {}
