import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailerService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.debug('Using Ethereal Email for development');

        const cachedTestAccount = this.configService.get(
          'ETHEREAL_TEST_ACCOUNT',
        );
        let testAccount;

        if (cachedTestAccount) {
          testAccount = JSON.parse(cachedTestAccount);
        } else {
          testAccount = await nodemailer.createTestAccount();
          this.configService.set(
            'ETHEREAL_TEST_ACCOUNT',
            JSON.stringify(testAccount),
          );
        }

        this.logger.debug('Ethereal Email test account:', {
          user: testAccount.user,
          pass: testAccount.pass,
          web: 'https://ethereal.email',
        });

        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } else {
        // For production, use real SMTP settings
        this.transporter = nodemailer.createTransport({
          host: this.configService.get('SMTP_HOST'),
          port: this.configService.get('SMTP_PORT'),
          secure: this.configService.get('SMTP_SECURE') === 'true',
          auth: {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS'),
          },
        });
      }

      // Verify the connection
      await this.transporter.verify();
      this.logger.log('Mail transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize mail transporter:', error);
      throw error;
    }
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
        this.logger.debug(`Email Preview URL: ${previewUrl}`);
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
