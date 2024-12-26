import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorService } from '../services/two-factor.service';
import { PrismaService } from '../../../core/database/prisma.service';
import * as speakeasy from 'speakeasy';
import { ErrorHandlingService } from 'src/common/errors/error-handling.service';
import { TwoFactorError } from 'src/common/errors/custom-errors';
import { ErrorCodes } from 'src/common/errors/error-codes';

jest.mock('speakeasy');
jest.mock('qrcode');

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  const mockPrismaService = {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
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
        TwoFactorService,
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

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  afterEach(() => {
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
      mockErrorHandlingService.handleAuthenticationError.mockImplementation(
        (error) => {
          throw error;
        },
      );

      await expect(service.verifyToken(userId, token)).rejects.toThrow(
        TwoFactorError,
      );
    });

    it('should return false if user has no 2FA secret', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        twoFactorSecret: null,
      });

      const error = new TwoFactorError(
        '2FA not set up for this account',
        { code: ErrorCodes.AUTH.TWO_FACTOR_REQUIRED },
        'verifyToken',
      );

      mockErrorHandlingService.handleAuthenticationError.mockRejectedValue(
        error,
      );

      await expect(service.verifyToken(userId, token)).rejects.toThrow(
        TwoFactorError,
      );
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
