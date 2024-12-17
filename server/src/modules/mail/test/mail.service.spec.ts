import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { MailerService } from '../mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailerService', () => {
  let service: MailerService;
  let mockTransporter;
  let mockConfigService;
  let mockRedisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock createTestAccount for Ethereal
    (nodemailer.createTestAccount as jest.Mock) = jest.fn().mockResolvedValue({
      user: 'ethereal-test-user',
      pass: 'ethereal-test-pass',
    });

    // Create mock transporter
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };

    mockConfigService = {
      get: jest.fn((key) => {
        const config = {
          NODE_ENV: 'test',
          SMTP_HOST: 'smtp.test.com',
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          SMTP_USER: 'test@test.com',
          SMTP_PASS: 'password',
          SMTP_FROM: 'noreply@test.com',
          FRONTEND_URL: 'http://test.com',
        };
        return config[key];
      }),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    // Mock createTransport
    (nodemailer.createTransport as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMail', () => {
    it('should send email successfully', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({ messageId: 'test-id' });

      const result = await service.sendMail(mailOptions);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@test.com',
        ...mailOptions,
      });
    });

    it('should return false on error', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('Send failed'));
      const result = await service.sendMail({
        to: 'test@example.com',
        subject: 'Test',
      });
      expect(result).toBe(false);
    });

    it('should handle missing transporter', async () => {
      (service as any).transporter = null;
      mockTransporter.sendMail.mockResolvedValueOnce({ messageId: 'test-id' });

      const result = await service.sendMail({
        to: 'test@example.com',
        subject: 'Test',
      });

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should handle invalid email address', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('Invalid email'),
      );

      const result = await service.sendMail({
        to: 'invalid-email',
        subject: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('Network error'),
      );

      const result = await service.sendMail({
        to: 'test@example.com',
        subject: 'Test',
      });

      expect(result).toBe(false);
    });
  });

  describe('Redis caching for Ethereal account', () => {
    it('should use cached ethereal account if valid', async () => {
      const cachedAccount = {
        user: 'cached-user',
        pass: 'cached-pass',
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(cachedAccount));
      mockConfigService.get.mockReturnValue('development');

      await service.onModuleInit();

      expect(nodemailer.createTestAccount).not.toHaveBeenCalled();
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('should create new account if cache is invalid', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      const newAccount = {
        user: 'new-user',
        pass: 'new-pass',
      };
      (nodemailer.createTestAccount as jest.Mock).mockResolvedValueOnce(
        newAccount,
      );
      mockConfigService.get.mockReturnValue('development');

      await service.onModuleInit();

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'ethereal_account',
        JSON.stringify(newAccount),
        60 * 60 * 24 * 7,
      );
    });
  });

  describe('Email Templates', () => {
    describe('sendLoginAlert', () => {
      it('should include all required security information', async () => {
        const loginData = {
          ip: '192.168.1.1',
          browser: 'Chrome',
          location: {
            country: 'US',
            city: 'New York',
            timezone: 'EST',
          },
          time: new Date('2024-01-01T12:00:00'),
        };

        await service.sendLoginAlert('test@example.com', loginData);

        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
          to: 'test@example.com',
          subject: 'New Login Alert',
          html:
            expect.stringContaining(loginData.ip) &&
            expect.stringContaining(loginData.browser) &&
            expect.stringContaining(loginData.location.city) &&
            expect.stringContaining(loginData.location.country),
        });
      });
    });

    describe('sendPasswordReset', () => {
      it('should include expiration warning', async () => {
        await service.sendPasswordReset('test@example.com', 'token');

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('30 minutes'),
          }),
        );
      });
    });

    describe('sendEmailVerification', () => {
      it('should include expiration warning', async () => {
        await service.sendEmailVerification('test@example.com', 'token');

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('15 minutes'),
          }),
        );
      });

      it('should include correct verification link', async () => {
        const token = 'verification-token';
        await service.sendEmailVerification('test@example.com', token);

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining(
              `${mockConfigService.get('FRONTEND_URL')}/verify-email?token=${token}`,
            ),
          }),
        );
      });
    });

    describe('sendWelcome', () => {
      it('should include welcome message', async () => {
        await service.sendWelcome('test@example.com', 'testuser');

        expect(mockTransporter.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining('Welcome to Nibblix, testuser!'),
          }),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle SMTP connection errors', async () => {
      mockTransporter.verify.mockRejectedValueOnce(
        new Error('SMTP connection failed'),
      );
      await expect(service.onModuleInit()).rejects.toThrow(
        'SMTP connection failed',
      );
    });

    it('should handle errors during Ethereal account creation', async () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'NODE_ENV') return 'development';
        return 'test';
      });

      mockRedisService.get.mockResolvedValueOnce(null);
      (nodemailer.createTestAccount as jest.Mock).mockRejectedValueOnce(
        new Error('Ethereal account creation failed'),
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailerService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: RedisService, useValue: mockRedisService },
        ],
      }).compile();

      const newService = module.get<MailerService>(MailerService);
      await expect(newService.onModuleInit()).rejects.toThrow(
        'Failed to initialize Ethereal account',
      );
    });

    it('should handle errors during Ethereal account verification', async () => {
      const cachedAccount = {
        user: 'cached-user',
        pass: 'cached-pass',
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(cachedAccount));
      mockTransporter.verify.mockRejectedValueOnce(
        new Error('Ethereal account verification failed'),
      );

      await expect(service.onModuleInit()).rejects.toThrow(
        'Ethereal account verification failed',
      );
    });
  });

  describe('Development Environment Logging', () => {
    describe('sendEmailVerification', () => {
      it('should log email details in development environment', async () => {
        mockConfigService.get.mockReturnValue('development');
        const logSpy = jest.spyOn(service['logger'], 'debug');

        await service.sendEmailVerification('test@example.com', 'token');

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('=============== EMAIL SENT ==============='),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Preview URL:'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('MessageId:'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('To: test@example.com'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Subject: Verify Your Email'),
        );
      });
    });

    describe('sendPasswordReset', () => {
      it('should log email details in development environment', async () => {
        mockConfigService.get.mockReturnValue('development');
        const logSpy = jest.spyOn(service['logger'], 'debug');

        await service.sendPasswordReset('test@example.com', 'token');

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('=============== EMAIL SENT ==============='),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Preview URL:'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('MessageId:'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('To: test@example.com'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Subject: Password Reset Request'),
        );
      });
    });

    describe('sendWelcome', () => {
      it('should log email details in development environment', async () => {
        mockConfigService.get.mockReturnValue('development');
        const logSpy = jest.spyOn(service['logger'], 'debug');

        await service.sendWelcome('test@example.com', 'testuser');

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('=============== EMAIL SENT ==============='),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Preview URL:'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('MessageId:'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('To: test@example.com'),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Subject: Welcome to Nibblix'),
        );
      });
    });
  });
});
