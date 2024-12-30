import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

const ETHEREAL_CREDENTIALS = {
  user: 'anastasia.bashirian@ethereal.email',
  pass: 'JaW4RKVnT52B5Y7rcu',
};

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
        this.logger.debug('Initializing Ethereal Email transport');
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: ETHEREAL_CREDENTIALS,
        });
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

      this.logger.log('Mail transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize mail transporter:', error);
      throw error;
    }
  }

  async sendLoginAlert(
    email: string,
    data: {
      ip: string;
      browser: string;
      location: {
        country: string;
        city: string;
        timezone: string;
      };
      time: Date;
    },
  ) {
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

  async sendEmailVerification(email: string, token: string): Promise<boolean> {
    const verificationLink = `${this.configService.get('FRONTEND_URL')}/auth/verify/${token}`;

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
      if (!this.transporter || !this.transporter.isIdle()) {
        this.logger.debug('Reinitializing transporter...');
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
    const resetLink = `${this.configService.get('FRONTEND_URL')}/auth/forgot-password/${token}`;

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
      subject: 'Welcome to Nibblix!',
      html: `
        <h1>Welcome to Nibblix, ${username}!</h1>
        <p>Thank you for joining our platform. We're excited to have you on board!</p>
        <p>If you have any questions, feel free to contact our support team.</p>
      `,
    });
  }
}
