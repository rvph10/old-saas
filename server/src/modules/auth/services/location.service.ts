import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as geoip from 'geoip-lite';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

  async isNewLoginLocation(userId: string, ipAddress: string): Promise<boolean> {
    const geo = geoip.lookup(ipAddress);
    if (!geo) return true;

    const recentLogin = await this.prisma.loginHistory.findFirst({
      where: {
        userId,
        ipAddress,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    return !recentLogin;
  }

  getLocationInfo(ipAddress: string) {
    const geo = geoip.lookup(ipAddress);
    return {
      country: geo?.country || 'Unknown',
      city: geo?.city || 'Unknown',
      timezone: geo?.timezone || 'Unknown',
    };
  }
}