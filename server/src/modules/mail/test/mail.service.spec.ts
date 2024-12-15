import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '../mail.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailerService', () => {
  let service: MailerService;
  let redisService: RedisService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockTransporter = {
    verify: jest.fn(),
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);
    redisService = module.get<RedisService>(RedisService);

    // Mock nodemailer.createTransport
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    mockTransporter.verify.mockResolvedValue(true);
  });

  describe('initialization', () => {
    it('should initialize ethereal transport in development', async () => {
      mockConfigService.get.mockReturnValue('development');
      const mockEtherealAccount = { 
        user: 'test@ethereal.email', 
        pass: 'testpass' 
      };
      (nodemailer.createTestAccount as jest.Mock).mockResolvedValue(mockEtherealAccount);

      await service.onModuleInit();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: mockEtherealAccount.user,
          pass: mockEtherealAccount.pass,
        },
      });
    });

    it('should initialize production transport in production', async () => {
      mockConfigService.get.mockImplementation((key) => {
        const config = {
          'NODE_ENV': 'production',
          'SMTP_HOST': 'smtp.example.com',
          'SMTP_PORT': 587,
          'SMTP_SECURE': 'false',
          'SMTP_USER': 'user',
          'SMTP_PASS': 'pass',
        };
        return config[key];
      });

      await service.onModuleInit();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user',
          pass: 'pass',
        },
      });
    });
  });

  describe('sendMail', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key) => {
        const config = {
          'NODE_ENV': 'production',
          'SMTP_FROM': 'noreply@nibblix.com'
        };
        return config[key];
      });
      await service.onModuleInit();
    });

    it('should send mail successfully', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      const result = await service.sendMail(mailOptions);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@nibblix.com',
        ...mailOptions,
      });
    });

    it('should handle send mail failure', async () => {
      const mailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      mockTransporter.sendMail.mockRejectedValue(new Error('Send failed'));

      const result = await service.sendMail(mailOptions);

      expect(result).toBe(false);
    });
  });

  describe('sendEmailVerification', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key) => {
        const config = {
          'NODE_ENV': 'production',
          'FRONTEND_URL': 'http://localhost:3000',
          'SMTP_FROM': 'noreply@nibblix.com'
        };
        return config[key];
      });
      await service.onModuleInit();
    });

    it('should send verification email', async () => {
      const email = 'test@example.com';
      const token = 'verification-token';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      const result = await service.sendEmailVerification(email, token);

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@nibblix.com',
        to: email,
        subject: 'Verify Your Email',
        html: expect.stringContaining('verification-token'),
      });
    });
  });

  describe('sendPasswordReset', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key) => {
        const config = {
          'NODE_ENV': 'production',
          'FRONTEND_URL': 'http://localhost:3000',
          'SMTP_FROM': 'noreply@nibblix.com'
        };
        return config[key];
      });
      await service.onModuleInit();
    });

    it('should send password reset email', async () => {
      const email = 'test@example.com';
      const token = 'reset-token';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
  
      const result = await service.sendPasswordReset(email, token);
  
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@nibblix.com',
        to: email,
        subject: 'Password Reset Request',
        html: expect.stringContaining('reset-token')
      });
    });
  });

  describe('sendWelcome', () => {
    beforeEach(async () => {
      mockConfigService.get.mockImplementation((key) => {
        const config = {
          'NODE_ENV': 'production',
          'SMTP_FROM': 'noreply@nibblix.com'
        };
        return config[key];
      });
      await service.onModuleInit();
    });

    it('should send welcome email', async () => {
      const email = 'test@example.com';
      const username = 'testuser';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
  
      const result = await service.sendWelcome(email, username);
  
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@nibblix.com',
        to: email,
        subject: 'Welcome to Nibblix',
        html: expect.stringContaining(username)
      });
    });
  });

  describe('ethereal account caching', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('development');
    });

    it('should use cached ethereal account if available and valid', async () => {
      const cachedAccount = {
        user: 'cached@ethereal.email',
        pass: 'cachedpass'
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedAccount));
      mockTransporter.verify.mockResolvedValue(true);

      await service.onModuleInit();

      expect(nodemailer.createTestAccount).not.toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: cachedAccount
        })
      );
    });

    it('should create new ethereal account if cache is invalid', async () => {
      const cachedAccount = {
        user: 'invalid@ethereal.email',
        pass: 'invalidpass'
      };
      const newAccount = {
        user: 'new@ethereal.email',
        pass: 'newpass'
      };
      
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedAccount));
      // First verify fails (cached credentials), second verify succeeds (new credentials)
      mockTransporter.verify
        .mockRejectedValueOnce(new Error('Invalid credentials'))
        .mockResolvedValueOnce(true);
      (nodemailer.createTestAccount as jest.Mock).mockResolvedValue(newAccount);

      await service.onModuleInit();

      expect(nodemailer.createTestAccount).toHaveBeenCalled();
      expect(mockRedisService.del).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'ethereal_account',
        JSON.stringify(newAccount),
        60 * 60 * 24 * 7
      );
    });
  });
});