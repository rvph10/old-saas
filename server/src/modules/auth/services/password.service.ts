import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { AppError, ErrorCodes, ErrorHandlingService, ValidationError } from '@core/errors';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  constructor(private readonly errorHandlingService: ErrorHandlingService) {}

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    try {
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

      if (!/[@$!%*?&-]/.test(password)) {
        errors.push(
          'Password must contain at least one special character (@$!%*?&-)',
        );
      }

      if (errors.length > 0) {
        throw new ValidationError(
          'Password validation failed',
          {
            code: ErrorCodes.VALIDATION.INVALID_PASSWORD,
            errors,
          },
          'validatePasswordStrength',
        );
      }

      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleValidationError(
        error,
        'validatePasswordStrength',
      );
    }
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

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const text = await response.text();
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
      return { isBreached: false };
    }
  }

  async validatePassword(password: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      const strengthCheck = this.validatePasswordStrength(password);
      if (!strengthCheck.isValid) {
        return strengthCheck;
      }

      const breachCheck = await this.checkPasswordBreached(password);
      if (breachCheck.isBreached) {
        throw new ValidationError(
          'Password found in data breach',
          {
            code: ErrorCodes.VALIDATION.PASSWORD_HISTORY,
            occurrences: breachCheck.occurrences,
          },
          'validatePassword',
        );
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.errorHandlingService.handleValidationError(
        error,
        'validatePassword',
      );
    }
  }
}
