import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { UAParser } from 'ua-parser-js';
import * as crypto from 'crypto';
import { ErrorHandlingService } from '@core/errors';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browserInfo: string;
  osInfo: string;
  deviceType: string;
  isMobile: boolean;
}

@Injectable()
export class DeviceService {
  constructor(
    private prisma: PrismaService,
    private errorHandlingService: ErrorHandlingService,
  ) {}

  getDeviceInfo(userAgent: string): DeviceInfo {
    try {
      const parser = new UAParser(userAgent);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();

      const deviceId = crypto
        .createHash('md5')
        .update(`${userAgent}${os.name}${browser.name}`)
        .digest('hex');

      return {
        deviceId,
        deviceName: `${browser.name} on ${os.name}`,
        browserInfo: `${browser.name} ${browser.version || ''}`,
        osInfo: `${os.name} ${os.version || ''}`,
        deviceType: device.type || 'desktop',
        isMobile: device.type === 'mobile',
      };
    } catch (error) {
      this.errorHandlingService.handleValidationError(error, 'getDeviceInfo');
    }
  }

  async registerDevice(userId: string, userAgent: string): Promise<string> {
    try {
      const deviceInfo = this.getDeviceInfo(userAgent);

      const device = await this.prisma.userDevice.upsert({
        where: { deviceId: deviceInfo.deviceId },
        update: {
          lastUsedAt: new Date(),
          browser: deviceInfo.browserInfo,
          os: deviceInfo.osInfo,
        },
        create: {
          userId,
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browserInfo,
          os: deviceInfo.osInfo,
        },
      });

      return device.deviceId;
    } catch (error) {
      this.errorHandlingService.handleDatabaseError(error, 'registerDevice');
    }
  }

  async getUserDevices(userId: string) {
    try {
      return this.prisma.userDevice.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
      });
    } catch (error) {
      this.errorHandlingService.handleDatabaseError(error, 'getUserDevices');
    }
  }

  async setDeviceTrusted(deviceId: string, userId: string, trusted: boolean) {
    try {
      return this.prisma.userDevice.updateMany({
        where: {
          deviceId,
          userId,
        },
        data: { isTrusted: trusted },
      });
    } catch (error) {
      this.errorHandlingService.handleDatabaseError(error, 'setDeviceTrusted');
    }
  }

  async removeDevice(deviceId: string, userId: string) {
    try {
      return this.prisma.userDevice.deleteMany({
        where: {
          deviceId,
          userId,
        },
      });
    } catch (error) {
      this.errorHandlingService.handleDatabaseError(error, 'removeDevice');
    }
  }
}
