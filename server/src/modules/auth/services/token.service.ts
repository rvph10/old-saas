// src/modules/auth/services/token.service.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { TokenMetadata, TokenPayload } from '../interfaces/token.interface';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async refreshTokens(oldRefreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
    const { isValid, payload, storedToken } = await this.verifyRefreshToken(oldRefreshToken);

    if (!isValid || !storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check for token reuse
    if (storedToken.revokedAt) {
      // Token reuse detected - revoke entire family
      await this.revokeFamily(storedToken.family, 'Token reuse detected');
      throw new UnauthorizedException('Security breach detected');
    }

    // Revoke the used refresh token
    await this.revokeToken(oldRefreshToken, 'Token refreshed');

    // Generate new token pair with same device and chain them
    const { accessToken, refreshToken } = await this.generateTokens(storedToken.user, {
      deviceId: payload.deviceId,
      ipAddress: storedToken.ipAddress,
      userAgent: storedToken.userAgent,
      previousToken: oldRefreshToken
    });

    return { accessToken, refreshToken };
  }

  async generateTokens(user: any, metadata?: TokenMetadata) {
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
      },
      {
        expiresIn: '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        type: 'refresh',
        deviceId: metadata?.deviceId,
        jti: uuidv4(),
      },
      {
        expiresIn: '7d',
      },
    );

    const hashedToken = this.hashToken(refreshToken);
    const family = metadata?.previousToken
      ? await this.getRefreshTokenFamily(metadata.previousToken)
      : uuidv4();

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        deviceId: metadata?.deviceId ?? null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: metadata?.userAgent ?? null,
        ipAddress: metadata?.ipAddress ?? null,
        family,
        successive: !!metadata?.previousToken,
      },
    });

    return { accessToken, refreshToken };
  }

  async verifyRefreshToken(token: string): Promise<{
    isValid: boolean;
    payload?: TokenPayload;
    storedToken?: any;
  }> {
    try {
      const payload = this.jwtService.verify(token) as TokenPayload;
      const hashedToken = this.hashToken(token);

      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token: hashedToken,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!storedToken) {
        this.logger.warn(
          `Invalid refresh token attempt for user ${payload.sub}`,
        );
        return { isValid: false };
      }

      return {
        isValid: true,
        payload,
        storedToken,
      };
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      return { isValid: false };
    }
  }

  private async getRefreshTokenFamily(token: string): Promise<string> {
    const hashedToken = this.hashToken(token);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      select: { family: true },
    });
    return storedToken?.family || uuidv4();
  }

  async revokeToken(token: string, reason: string): Promise<void> {
    const hashedToken = this.hashToken(token);
    await this.prisma.refreshToken.updateMany({
      where: { token: hashedToken },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async revokeFamily(family: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
    return result.count;
  }

  async invalidateUserTokens(userId: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }
}
