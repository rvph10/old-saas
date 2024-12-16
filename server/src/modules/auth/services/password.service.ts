import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push(
        'Password must contain at least one special character (@$!%*?&)',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async checkPasswordBreached(password: string): Promise<{
    isBreached: boolean;
    occurrences?: number;
  }> {
    try {
      const sha1 = crypto
        .createHash('sha1')
        .update(password)
        .digest('hex')
        .toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
      );
      const text = await response.text();

      // Search for the suffix in the response
      const lines = text.split('\n');
      for (const line of lines) {
        const [hash, count] = line.split(':');
        if (hash === suffix) {
          return {
            isBreached: true,
            occurrences: parseInt(count.trim(), 10),
          };
        }
      }

      return { isBreached: false };
    } catch (error) {
      this.logger.error('Password breach check failed:', error);
      // Return false in case of API failure to not block registration
      return { isBreached: false };
    }
  }

  async validatePassword(password: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const strengthCheck = this.validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      return strengthCheck;
    }

    const breachCheck = await this.checkPasswordBreached(password);
    if (breachCheck.isBreached) {
      return {
        isValid: false,
        errors: [
          `This password has been found in ${breachCheck.occurrences} data breaches. Please choose a different password.`,
        ],
      };
    }

    return { isValid: true, errors: [] };
  }
}
