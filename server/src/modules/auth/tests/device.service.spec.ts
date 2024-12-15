import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from '../services/device.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DeviceService', () => {
  let service: DeviceService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userDevice: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getDeviceInfo', () => {
    it('should parse user agent and return device info', () => {
      const result = service.getDeviceInfo(mockUserAgent);

      expect(result).toEqual(expect.objectContaining({
        deviceId: expect.any(String),
        deviceName: expect.any(String),
        browserInfo: expect.stringContaining('Chrome'),
        osInfo: expect.stringContaining('Windows'),
        deviceType: 'desktop',
        isMobile: false,
      }));
    });

    it('should generate consistent deviceId for same user agent', () => {
      const result1 = service.getDeviceInfo(mockUserAgent);
      const result2 = service.getDeviceInfo(mockUserAgent);

      expect(result1.deviceId).toBe(result2.deviceId);
    });

    it('should handle mobile user agent', () => {
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';
      
      const result = service.getDeviceInfo(mobileUserAgent);

      expect(result).toEqual(expect.objectContaining({
        deviceType: 'mobile',
        isMobile: true,
        osInfo: expect.stringContaining('iOS'),
        browserInfo: expect.stringContaining('Safari'),
      }));
    });
  });

  describe('registerDevice', () => {
    const userId = 'test-user-id';
    const mockDevice = {
      id: 'device-id',
      deviceId: 'generated-device-id',
      deviceName: 'Chrome on Windows',
      deviceType: 'desktop',
      browser: 'Chrome 120.0.0',
      os: 'Windows 10',
      userId: 'test-user-id',
    };

    beforeEach(() => {
      mockPrismaService.userDevice.upsert.mockResolvedValue(mockDevice);
    });

    it('should register a new device', async () => {
      const result = await service.registerDevice(userId, mockUserAgent);

      expect(result).toBe(mockDevice.deviceId);
      expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceId: expect.any(String) },
          create: expect.objectContaining({
            userId,
            deviceType: 'desktop',
            browser: expect.stringContaining('Chrome'),
            os: expect.stringContaining('Windows'),
          }),
          update: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should update existing device', async () => {
      await service.registerDevice(userId, mockUserAgent);

      expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            lastUsedAt: expect.any(Date),
            browser: expect.any(String),
            os: expect.any(String),
          }),
        })
      );
    });
  });

  describe('getUserDevices', () => {
    const userId = 'test-user-id';
    const mockDevices = [
      {
        id: 'device-1',
        deviceId: 'device-id-1',
        deviceName: 'Chrome on Windows',
        lastUsedAt: new Date(),
      },
      {
        id: 'device-2',
        deviceId: 'device-id-2',
        deviceName: 'Safari on iPhone',
        lastUsedAt: new Date(),
      },
    ];

    beforeEach(() => {
      mockPrismaService.userDevice.findMany.mockResolvedValue(mockDevices);
    });

    it('should return user devices ordered by last used', async () => {
      const result = await service.getUserDevices(userId);

      expect(result).toEqual(mockDevices);
      expect(mockPrismaService.userDevice.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
      });
    });

    it('should return empty array when no devices found', async () => {
      mockPrismaService.userDevice.findMany.mockResolvedValue([]);

      const result = await service.getUserDevices(userId);

      expect(result).toEqual([]);
    });
  });

  describe('setDeviceTrusted', () => {
    const userId = 'test-user-id';
    const deviceId = 'test-device-id';

    beforeEach(() => {
      mockPrismaService.userDevice.updateMany.mockResolvedValue({ count: 1 });
    });

    it('should set device as trusted', async () => {
      await service.setDeviceTrusted(deviceId, userId, true);

      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith({
        where: {
          deviceId,
          userId,
        },
        data: { isTrusted: true },
      });
    });

    it('should set device as untrusted', async () => {
      await service.setDeviceTrusted(deviceId, userId, false);

      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith({
        where: {
          deviceId,
          userId,
        },
        data: { isTrusted: false },
      });
    });
  });

  describe('removeDevice', () => {
    const userId = 'test-user-id';
    const deviceId = 'test-device-id';

    beforeEach(() => {
      mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 1 });
    });

    it('should remove device', async () => {
      await service.removeDevice(deviceId, userId);

      expect(mockPrismaService.userDevice.deleteMany).toHaveBeenCalledWith({
        where: {
          deviceId,
          userId,
        },
      });
    });

    it('should handle non-existent device gracefully', async () => {
      mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 0 });

      await service.removeDevice(deviceId, userId);

      expect(mockPrismaService.userDevice.deleteMany).toHaveBeenCalled();
    });
  });
});