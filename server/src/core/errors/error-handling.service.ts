import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppError,
  DatabaseError,
  SessionError,
  ValidationError,
} from './custom-errors';
import { ErrorCodes } from './error-codes';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MetricsService } from '@infrastructure/monitoring/metrics.service';

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);
  private readonly isDevelopment: boolean;

  constructor(
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.isDevelopment = configService.get('NODE_ENV') === 'development';
  }

  handleDatabaseError(error: Error, context: string): never {
    this.logError(error, context);
    this.metricsService.incrementCounter('database_errors');

    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new DatabaseError('Unique constraint violation', {
            code: ErrorCodes.DATABASE.UNIQUE_CONSTRAINT,
            fields: error.meta?.target,
            context,
          });
        case 'P2025':
          throw new DatabaseError('Record not found', {
            code: ErrorCodes.DATABASE.RECORD_NOT_FOUND,
            context,
          });
        case 'P2014':
          throw new DatabaseError('Invalid data provided', {
            code: ErrorCodes.DATABASE.INVALID_DATA,
            context,
          });
        default:
          throw new DatabaseError('Database operation failed', {
            code: ErrorCodes.DATABASE.OPERATION_FAILED,
            context,
          });
      }
    }

    throw new DatabaseError('Unexpected database error', {
      code: ErrorCodes.DATABASE.UNKNOWN_ERROR,
      context,
    });
  }

  handleValidationError(error: Error, context: string): never {
    this.logError(error, context);
    this.metricsService.incrementCounter('validation_errors');

    throw new ValidationError('Validation failed', {
      code: ErrorCodes.VALIDATION.INVALID_INPUT,
      details: this.formatErrorDetails(error),
      context,
    });
  }

  handleSessionError(error: Error, context: string): never {
    this.logError(error, context);
    this.metricsService.incrementCounter('session_errors');

    throw new SessionError('Session error occurred', {
      code: ErrorCodes.AUTH.SESSION_EXPIRED,
      details: this.formatErrorDetails(error),
      context,
    });
  }

  handleAuthenticationError(error: Error, context: string): never {
    this.logError(error, context);
    this.metricsService.incrementCounter('authentication_errors');

    throw new AppError('Authentication failed', 'AUTH_ERROR', 401, {
      code: ErrorCodes.AUTH.INVALID_CREDENTIALS,
      details: this.formatErrorDetails(error),
      context,
    });
  }

  private formatErrorDetails(error: Error): any {
    if (!this.isDevelopment) {
      return undefined;
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  private logError(error: Error, context: string): void {
    this.logger.error(`Error in ${context}: ${error.message}`, error.stack, {
      errorName: error.name,
      timestamp: new Date().toISOString(),
      context,
    });
  }
}
