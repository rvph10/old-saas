import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as ErrorCodes from './error-codes';
import { DatabaseError, ValidationError } from './custom-errors';

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);

  handleDatabaseError(error: Error, context: string): never {
    this.logger.error(`Database error in ${context}:`, error.stack);

    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case ErrorCodes.DATABASE_ERRORS.UNIQUE_CONSTRAINT:
          throw new DatabaseError('Unique constraint violation', {
            fields: error.meta?.target,
          });
        case ErrorCodes.DATABASE_ERRORS.RECORD_NOT_FOUND:
          throw new DatabaseError('Record not found');
        case ErrorCodes.DATABASE_ERRORS.INVALID_DATA:
          throw new DatabaseError('Invalid data provided');
        default:
          throw new DatabaseError('Database operation failed');
      }
    }

    throw new DatabaseError('Unexpected database error');
  }

  handleValidationError(error: Error, context: string): never {
    this.logger.error(`Validation error in ${context}:`, error.stack);
    throw new ValidationError(error.message, {
      code: ErrorCodes.VALIDATION_ERRORS.INVALID_INPUT
    });
  }

  handleAuthError(error: Error, context: string): never {
    this.logger.error(`Authentication error in ${context}:`, error.stack);
    throw new ValidationError(error.message, {
      code: ErrorCodes.AUTH_ERRORS.INVALID_CREDENTIALS
    });
  }

  logError(error: Error, context: string): void {
    this.logger.error(
      `Error in ${context}:`,
      error.stack,
      {
        name: error.name,
        message: error.message,
        timestamp: new Date().toISOString(),
      }
    );
  }
}