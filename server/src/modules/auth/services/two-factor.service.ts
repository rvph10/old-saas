import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import {
  AppError,
  ErrorCodes,
  ErrorHandlingService,
  TwoFactorError,
} from '@core/errors';

@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private errorHandlingService: ErrorHandlingService,
  ) {}

  async generateSecret(userId: string) {
    const secret = speakeasy.generateSecret({
      name: `Nibblix (${process.env.APP_ENV || 'development'})`,
    });

    // Store the secret temporarily
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true },
      });

      if (!user?.twoFactorSecret) {
        throw new TwoFactorError(
          '2FA not set up for this account',
          { code: ErrorCodes.AUTH.TWO_FACTOR_REQUIRED },
          'verifyToken',
        );
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 1,
      });

      if (!isValid) {
        throw new TwoFactorError(
          'Invalid 2FA token',
          { code: ErrorCodes.AUTH.INVALID_2FA_TOKEN },
          'verifyToken',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleAuthenticationError(error, 'verifyToken');
    }
  }

  async enable2FA(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disable2FA(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
  }
}
