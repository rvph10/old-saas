import { RedisService } from '@infrastructure/cache/redis.service';
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';


@Injectable()
export class CsrfService {
  private readonly TOKEN_LENGTH = 32;
  private readonly TOKEN_TTL = 24 * 60 * 60; // 24 hours

  constructor(private readonly redisService: RedisService) {}

  async generateToken(sessionId: string): Promise<string> {
    const token = randomBytes(this.TOKEN_LENGTH).toString('hex');
    await this.redisService.set(`csrf:${sessionId}`, token, this.TOKEN_TTL);
    return token;
  }

  async validateToken(sessionId: string, token: string): Promise<boolean> {
    const storedToken = await this.redisService.get(`csrf:${sessionId}`);
    return storedToken === token;
  }

  async invalidateToken(sessionId: string): Promise<void> {
    await this.redisService.del(`csrf:${sessionId}`);
  }
}
