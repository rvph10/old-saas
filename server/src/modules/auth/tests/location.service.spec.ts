import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from '../services/location.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as geoip from 'geoip-lite';
import { ErrorHandlingService } from 'src/common/errors/error-handling.service';
import { ValidationError } from 'class-validator';

jest.mock('geoip-lite');

describe('LocationService', () => {
  let service: LocationService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    loginHistory: {
      findFirst: jest.fn(),
    },
  };

  const mockErrorHandlingService = {
    handleAuthenticationError: jest.fn(),
    handleValidationError: jest.fn(),
    handleDatabaseError: jest.fn(),
    handleSessionError: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ErrorHandlingService,
          useValue: mockErrorHandlingService,
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isNewLoginLocation', () => {
    const userId = 'test-user-id';
    const ipAddress = '192.168.1.1';

    beforeEach(() => {
      (geoip.lookup as jest.Mock).mockReturnValue({
        country: 'US',
        city: 'New York',
        timezone: 'America/New_York',
      });
    });

    it('should return true for new location', async () => {
      mockPrismaService.loginHistory.findFirst.mockResolvedValue(null);

      const result = await service.isNewLoginLocation(userId, ipAddress);
      expect(result).toBe(true);
    });

    it('should return false for recent login from same location', async () => {
      mockPrismaService.loginHistory.findFirst.mockResolvedValue({
        id: 'login-1',
        ipAddress,
      });

      const result = await service.isNewLoginLocation(userId, ipAddress);
      expect(result).toBe(false);
    });

    it('should return true when geoip lookup fails', async () => {
      (geoip.lookup as jest.Mock).mockReturnValue(null);

      const result = await service.isNewLoginLocation(userId, ipAddress);
      expect(result).toBe(true);
    });
  });

  describe('getLocationInfo', () => {
    it('should return location information', () => {
      const ipAddress = '192.168.1.1';
      const mockGeoData = {
        country: 'US',
        city: 'New York',
        timezone: 'America/New_York',
      };

      (geoip.lookup as jest.Mock).mockReturnValue(mockGeoData);

      const result = service.getLocationInfo(ipAddress);
      expect(result).toEqual({
        country: 'US',
        city: 'New York',
        timezone: 'America/New_York',
      });
    });
  });
});
