import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UAParser } from 'ua-parser-js';
import * as crypto from 'crypto';

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
  constructor(private prisma: PrismaService) {}

  getDeviceInfo(userAgent: string): DeviceInfo {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    // Create a unique device ID from user agent and other factors
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
  }

  async registerDevice(userId: string, userAgent: string): Promise<string> {
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
  }

  async getUserDevices(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async setDeviceTrusted(deviceId: string, userId: string, trusted: boolean) {
    return this.prisma.userDevice.updateMany({
      where: {
        deviceId,
        userId,
      },
      data: { isTrusted: trusted },
    });
  }

  async removeDevice(deviceId: string, userId: string) {
    return this.prisma.userDevice.deleteMany({
      where: {
        deviceId,
        userId,
      },
    });
  }
}
