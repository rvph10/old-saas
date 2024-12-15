import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from '../services/device.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { UAParser } from 'ua-parser-js';

jest.mock('ua-parser-js');

describe('DeviceService', () => {
  let service: DeviceService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userDevice: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockUserAgents = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    tablet: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  };

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

    // Reset all mocks
    jest.clearAllMocks();
    (UAParser as jest.MockedClass<typeof UAParser>).mockClear();
  });

  describe('getDeviceInfo', () => {
    beforeEach(() => {
      (UAParser as jest.MockedClass<typeof UAParser>).mockImplementation(() => ({
        getBrowser: jest.fn().mockReturnValue({ name: 'Chrome', version: '120.0.0' }),
        getOS: jest.fn().mockReturnValue({ name: 'Windows', version: '10' }),
        getDevice: jest.fn().mockReturnValue({ type: 'desktop' }),
        getUA: jest.fn(),
        getCPU: jest.fn(),
        getEngine: jest.fn(),
        getResult: jest.fn(),
        setUA: jest.fn(),
      }));
    });

    it('should parse desktop user agent correctly', () => {
      const result = service.getDeviceInfo(mockUserAgents.desktop);

      expect(result).toEqual({
        deviceId: expect.any(String),
        deviceName: 'Chrome on Windows',
        browserInfo: 'Chrome 120.0.0',
        osInfo: 'Windows 10',
        deviceType: 'desktop',
        isMobile: false,
      });
    });

    it('should parse mobile user agent correctly', () => {
      (UAParser as jest.MockedClass<typeof UAParser>).mockImplementation(() => ({
        getBrowser: jest.fn().mockReturnValue({ name: 'Mobile Safari', version: '14.1.2' }),
        getOS: jest.fn().mockReturnValue({ name: 'iOS', version: '14.7.1' }),
        getDevice: jest.fn().mockReturnValue({ type: 'mobile' }),
        getUA: jest.fn(),
        getCPU: jest.fn(),
        getEngine: jest.fn(),
        getResult: jest.fn(),
        setUA: jest.fn(),
      }));

      const result = service.getDeviceInfo(mockUserAgents.mobile);

      expect(result).toEqual({
        deviceId: expect.any(String),
        deviceName: 'Mobile Safari on iOS',
        browserInfo: 'Mobile Safari 14.1.2',
        osInfo: 'iOS 14.7.1',
        deviceType: 'mobile',
        isMobile: true,
      });
    });

    it('should handle missing browser or OS versions', () => {
      (UAParser as jest.MockedClass<typeof UAParser>).mockImplementation(() => ({
        getBrowser: jest.fn().mockReturnValue({ name: 'Chrome', version: null }),
        getOS: jest.fn().mockReturnValue({ name: 'Windows', version: null }),
        getDevice: jest.fn().mockReturnValue({ type: 'desktop' }),
        getUA: jest.fn(),
        getCPU: jest.fn(),
        getEngine: jest.fn(),
        getResult: jest.fn(),
        setUA: jest.fn(),
      }));

      const result = service.getDeviceInfo(mockUserAgents.desktop);

      expect(result.browserInfo).toBe('Chrome ');
      expect(result.osInfo).toBe('Windows ');
    });

    it('should generate consistent deviceId for same device info', () => {
      const result1 = service.getDeviceInfo(mockUserAgents.desktop);
      const result2 = service.getDeviceInfo(mockUserAgents.desktop);

      expect(result1.deviceId).toBe(result2.deviceId);
    });

    it('should generate different deviceId for different device info', () => {
      const desktopResult = service.getDeviceInfo(mockUserAgents.desktop);
      
      (UAParser as jest.MockedClass<typeof UAParser>).mockImplementation(() => ({
        getBrowser: jest.fn().mockReturnValue({ name: 'Mobile Safari', version: '14.1.2' }),
        getOS: jest.fn().mockReturnValue({ name: 'iOS', version: '14.7.1' }),
        getDevice: jest.fn().mockReturnValue({ type: 'mobile' }),
        getUA: jest.fn(),
        getCPU: jest.fn(),
        getEngine: jest.fn(),
        getResult: jest.fn(),
        setUA: jest.fn(),
      }));

      const mobileResult = service.getDeviceInfo(mockUserAgents.mobile);

      expect(desktopResult.deviceId).not.toBe(mobileResult.deviceId);
    });
  });

  describe('registerDevice', () => {
    const userId = 'test-user-id';
    const mockDeviceInfo = {
      deviceId: 'generated-device-id',
      deviceName: 'Chrome on Windows',
      deviceType: 'desktop',
      browserInfo: 'Chrome 120.0.0',
      osInfo: 'Windows 10',
      isMobile: false,
    };

    beforeEach(() => {
      jest.spyOn(service, 'getDeviceInfo').mockReturnValue(mockDeviceInfo);
    });

    it('should register a new device successfully', async () => {
      const mockDevice = {
        id: 'device-db-id',
        ...mockDeviceInfo,
        userId,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.userDevice.upsert.mockResolvedValue(mockDevice);

      const result = await service.registerDevice(userId, mockUserAgents.desktop);

      expect(result).toBe(mockDeviceInfo.deviceId);
      expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith({
        where: { deviceId: mockDeviceInfo.deviceId },
        create: expect.objectContaining({
          userId,
          deviceId: mockDeviceInfo.deviceId,
          deviceName: mockDeviceInfo.deviceName,
          deviceType: mockDeviceInfo.deviceType,
          browser: mockDeviceInfo.browserInfo,
          os: mockDeviceInfo.osInfo,
        }),
        update: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          browser: mockDeviceInfo.browserInfo,
          os: mockDeviceInfo.osInfo,
        }),
      });
    });

    it('should update existing device information', async () => {
      const existingDevice = {
        id: 'device-db-id',
        deviceId: mockDeviceInfo.deviceId,
        userId,
        lastUsedAt: new Date(Date.now() - 86400000), // 1 day ago
      };

      mockPrismaService.userDevice.upsert.mockResolvedValue({
        ...existingDevice,
        lastUsedAt: new Date(),
      });

      await service.registerDevice(userId, mockUserAgents.desktop);

      expect(mockPrismaService.userDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceId: mockDeviceInfo.deviceId },
          update: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should handle errors during device registration', async () => {
      mockPrismaService.userDevice.upsert.mockRejectedValue(new Error('Database error'));

      await expect(service.registerDevice(userId, mockUserAgents.desktop))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('getUserDevices', () => {
    const userId = 'test-user-id';
    const mockDevices = [
      {
        id: 'device-1',
        deviceId: 'device-id-1',
        deviceName: 'Chrome on Windows',
        deviceType: 'desktop',
        browser: 'Chrome 120.0.0',
        os: 'Windows 10',
        lastUsedAt: new Date(),
        isTrusted: false,
      },
      {
        id: 'device-2',
        deviceId: 'device-id-2',
        deviceName: 'Safari on iPhone',
        deviceType: 'mobile',
        browser: 'Mobile Safari 14.1.2',
        os: 'iOS 14.7.1',
        lastUsedAt: new Date(),
        isTrusted: true,
      },
    ];

    it('should return all user devices ordered by last used', async () => {
      mockPrismaService.userDevice.findMany.mockResolvedValue(mockDevices);

      const result = await service.getUserDevices(userId);

      expect(result).toEqual(mockDevices);
      expect(mockPrismaService.userDevice.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
      });
    });

    it('should return empty array when user has no devices', async () => {
      mockPrismaService.userDevice.findMany.mockResolvedValue([]);

      const result = await service.getUserDevices(userId);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockPrismaService.userDevice.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getUserDevices(userId))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('setDeviceTrusted', () => {
    const userId = 'test-user-id';
    const deviceId = 'test-device-id';

    it('should set device as trusted', async () => {
      mockPrismaService.userDevice.updateMany.mockResolvedValue({ count: 1 });

      await service.setDeviceTrusted(deviceId, userId, true);

      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith({
        where: { deviceId, userId },
        data: { isTrusted: true },
      });
    });

    it('should set device as untrusted', async () => {
      mockPrismaService.userDevice.updateMany.mockResolvedValue({ count: 1 });

      await service.setDeviceTrusted(deviceId, userId, false);

      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalledWith({
        where: { deviceId, userId },
        data: { isTrusted: false },
      });
    });

    it('should handle non-existent device', async () => {
      mockPrismaService.userDevice.updateMany.mockResolvedValue({ count: 0 });

      await service.setDeviceTrusted(deviceId, userId, true);

      expect(mockPrismaService.userDevice.updateMany).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaService.userDevice.updateMany.mockRejectedValue(new Error('Database error'));

      await expect(service.setDeviceTrusted(deviceId, userId, true))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('removeDevice', () => {
    const userId = 'test-user-id';
    const deviceId = 'test-device-id';

    it('should remove device successfully', async () => {
      mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeDevice(deviceId, userId);

      expect(mockPrismaService.userDevice.deleteMany).toHaveBeenCalledWith({
        where: { deviceId, userId },
      });
    });

    it('should handle non-existent device removal', async () => {
      mockPrismaService.userDevice.deleteMany.mockResolvedValue({ count: 0 });

      await service.removeDevice(deviceId, userId);

      expect(mockPrismaService.userDevice.deleteMany).toHaveBeenCalledWith({
        where: { deviceId, userId },
      });
    });

    it('should handle database errors during removal', async () => {
      mockPrismaService.userDevice.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(service.removeDevice(deviceId, userId))
        .rejects
        .toThrow('Database error');
    });
  });
});