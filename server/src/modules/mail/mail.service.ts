import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { convert } from 'html-to-text';

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const ETHEREAL_CACHE_KEY = 'ethereal_account';
const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.debug('Initializing Ethereal Email transport');
        const etherealAccount = await this.getOrCreateEtherealAccount();

        if (etherealAccount) {
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: etherealAccount.user,
              pass: etherealAccount.pass,
            },
          });
        } else {
          throw new Error('Failed to initialize Ethereal account');
        }
      } else {
        this.transporter = nodemailer.createTransport({
          host: this.configService.get('SMTP_HOST'),
          port: parseInt(this.configService.get('SMTP_PORT')),
          secure: this.configService.get('SMTP_SECURE') === 'true',
          auth: {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS'),
          },
        });
      }

      await this.transporter.verify();
      this.logger.log('Mail transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize mail transporter:', error);
      throw error;
    }
  }

  async sendLoginAlert(email: string, data: {
    ip: string;
    browser: string;
    location: {
      country: string;
      city: string;
      timezone: string;
    };
    time: Date;
  }) {
    const html = `
      <h2>New Login Detected</h2>
      <p>We detected a new login to your account from an unrecognized device:</p>
      <ul>
        <li>Time: ${data.time.toLocaleString()}</li>
        <li>Location: ${data.location.city}, ${data.location.country}</li>
        <li>IP Address: ${data.ip}</li>
        <li>Browser: ${data.browser}</li>
      </ul>
      <p>If this wasn't you, please change your password immediately and enable 2FA if you haven't already.</p>
    `;

    await this.transporter.sendMail({
      to: email,
      subject: 'New Login Alert',
      html,
    });
  }

  private async getOrCreateEtherealAccount(): Promise<any> {
    try {
      // Try to get cached account
      const cachedAccount = await this.redisService.get(ETHEREAL_CACHE_KEY);

      if (cachedAccount) {
        const parsed = JSON.parse(cachedAccount);

        // Verify cached credentials still work
        try {
          const testTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: parsed.user,
              pass: parsed.pass,
            },
          });
          await testTransporter.verify();

          this.logger.debug('Using cached Ethereal account');
          return parsed;
        } catch (e) {
          this.logger.warn('Cached credentials invalid, creating new account');
          await this.redisService.del(ETHEREAL_CACHE_KEY);
        }
      }

      // Create new account if none cached
      this.logger.debug('Creating new Ethereal account');
      const testAccount = await nodemailer.createTestAccount();

      if (testAccount) {
        // Cache the new account
        await this.redisService.set(
          ETHEREAL_CACHE_KEY,
          JSON.stringify(testAccount),
          CACHE_TTL,
        );
        return testAccount;
      }

      throw new Error('Failed to create Ethereal account');
    } catch (error) {
      this.logger.error('Failed to get/create Ethereal account:', error);
      return null;
    }
  }

  async sendEmailVerification(email: string, token: string): Promise<boolean> {
    const verificationLink = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;

    return this.sendMail({
      to: email,
      subject: 'Verify Your Email',
      html: `
        <h1>Verify Your Email Address</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationLink}">Verify Email</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    });
  }

  async sendMail(options: MailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const info = await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || 'noreply@nibblix.com',
        ...options,
      });

      if (this.configService.get('NODE_ENV') === 'development') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        this.logger.debug('=============== EMAIL SENT ===============');
        this.logger.debug(`Preview URL: ${previewUrl}`);
        this.logger.debug(`MessageId: ${info.messageId}`);
        this.logger.debug(`To: ${options.to}`);
        this.logger.debug(`Subject: ${options.subject}`);
        this.logger.debug('=======================================');
      }

      this.logger.log(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      return false;
    }
  }

  // Helper method for password reset emails
  async sendPasswordReset(email: string, token: string): Promise<boolean> {
    const resetLink = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

    return this.sendMail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
        <p>This link will expire in 30 minutes.</p>
      `,
    });
  }

  // Helper method for welcome emails
  async sendWelcome(email: string, username: string): Promise<boolean> {
    return this.sendMail({
      to: email,
      subject: 'Welcome to Nibblix',
      html: `
        <h1>Welcome to Nibblix, ${username}!</h1>
        <p>Thank you for joining our platform. We're excited to have you on board!</p>
        <p>If you have any questions, feel free to contact our support team.</p>
      `,
    });
  }
}
