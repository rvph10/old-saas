import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorService } from '../services/two-factor.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as speakeasy from 'speakeasy';

jest.mock('speakeasy');
jest.mock('qrcode');

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('generateSecret', () => {
    const userId = 'test-user-id';

    it('should generate and store 2FA secret', async () => {
      const mockSecret = {
        base32: 'TESTBASE32SECRET',
        otpauth_url: 'otpauth://totp/Test:user?secret=TESTBASE32SECRET',
      };
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);

      const result = await service.generateSecret(userId);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { twoFactorSecret: mockSecret.base32 },
      });
    });
  });

  describe('verifyToken', () => {
    const userId = 'test-user-id';
    const token = '123456';

    it('should verify valid token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        twoFactorSecret: 'SECRET',
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyToken(userId, token);

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'SECRET',
        encoding: 'base32',
        token,
        window: 1,
      });
    });

    it('should return false for invalid token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        twoFactorSecret: 'SECRET',
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      const result = await service.verifyToken(userId, token);
      expect(result).toBe(false);
    });

    it('should return false if user has no 2FA secret', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        twoFactorSecret: null,
      });

      const result = await service.verifyToken(userId, token);
      expect(result).toBe(false);
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA for user', async () => {
      const userId = 'test-user-id';
      await service.enable2FA(userId);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
    });
  });

  describe('disable2FA', () => {
    it('should disable 2FA for user', async () => {
      const userId = 'test-user-id';
      await service.disable2FA(userId);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    });
  });
});