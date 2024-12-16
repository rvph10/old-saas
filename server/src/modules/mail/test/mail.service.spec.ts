import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { MailerService } from '../mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailerService', () => {
  let service: MailerService;
  let configService: ConfigService;
  let redisService: RedisService;
  let mockTransporter;

  const mockConfigService = {
    get: jest.fn((key) => {
      const config = {
        NODE_ENV: 'test',
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'test@test.com',
        SMTP_PASS: 'password',
        SMTP_FROM: 'noreply@test.com',
        FRONTEND_URL: 'http://test.com'
      };
      return config[key];
    }),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  mockTransporter = {
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({}),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

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
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
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
  });

  describe('sendEmailVerification', () => {
    it('should send verification email', async () => {
      const email = 'test@example.com';
      const token = 'verify-token';
      
      await service.sendEmailVerification(email, token);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Verify Your Email',
        html: expect.stringContaining(token)
      }));
    });
  });

  describe('sendLoginAlert', () => {
    it('should send login alert email', async () => {
      const email = 'test@example.com';
      const loginData = {
        ip: '127.0.0.1',
        browser: 'Chrome',
        location: {
          country: 'US',
          city: 'New York',
          timezone: 'EST'
        },
        time: new Date()
      };

      await service.sendLoginAlert(email, loginData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'New Login Alert',
        html: expect.stringContaining(loginData.ip)
      }));
    });
  });

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      const email = 'test@example.com';
      const token = 'reset-token';
      
      await service.sendPasswordReset(email, token);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Password Reset Request',
        html: expect.stringContaining(token)
      }));
    });
  });

  describe('sendWelcome', () => {
    it('should send welcome email', async () => {
      const email = 'test@example.com';
      const username = 'testuser';
      
      await service.sendWelcome(email, username);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Welcome to Nibblix',
        html: expect.stringContaining(username)
      }));
    });
  });
});