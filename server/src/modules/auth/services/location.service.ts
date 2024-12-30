import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as geoip from 'geoip-lite';
import {
  AppError,
  ErrorCodes,
  ErrorHandlingService,
  ValidationError,
} from '@core/errors';

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private errorHandlingService: ErrorHandlingService,
  ) {}

  async isNewLoginLocation(
    userId: string,
    ipAddress: string,
  ): Promise<boolean> {
    try {
      if (!ipAddress) {
        throw new ValidationError(
          'IP address is required',
          { code: ErrorCodes.VALIDATION.INVALID_INPUT },
          'isNewLoginLocation',
        );
      }

      const geo = geoip.lookup(ipAddress);
      if (!geo) return true;

      const recentLogin = await this.prisma.loginHistory.findFirst({
        where: {
          userId,
          ipAddress,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      });

      return !recentLogin;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleValidationError(
        error,
        'isNewLoginLocation',
      );
    }
  }

  getLocationInfo(ipAddress: string) {
    try {
      if (!ipAddress) {
        throw new ValidationError(
          'IP address is required',
          { code: ErrorCodes.VALIDATION.INVALID_INPUT },
          'getLocationInfo',
        );
      }

      const geo = geoip.lookup(ipAddress);
      if (!geo) {
        return {
          country: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
        };
      }

      return {
        country: geo.country || 'Unknown',
        city: geo.city || 'Unknown',
        timezone: geo.timezone || 'Unknown',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleValidationError(error, 'getLocationInfo');
    }
  }
}
