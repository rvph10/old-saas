import { logger } from './logger';
import {
  AppError,
  ApiError,
  ValidationError,
  AuthenticationError,
  NetworkError,
} from './errors';

export interface ErrorHandlerOptions {
  silent?: boolean;
  context?: string;
  throwError?: boolean;
}

export class ErrorHandler {
  static async handle(
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): Promise<AppError> {
    const { silent = false, context = 'generic', throwError = false } = options;

    let normalizedError: AppError;

    // Normalize the error
    if (error instanceof AppError) {
      normalizedError = error;
    } else if (error instanceof Error) {
      normalizedError = new AppError(error.message, 'UNKNOWN_ERROR', {
        originalError: {
          name: error.name,
          stack: error.stack,
        },
      });
    } else {
      normalizedError = new AppError(
        'An unknown error occurred',
        'UNKNOWN_ERROR',
        { originalError: error }
      );
    }

    // Log the error unless silent is true
    if (!silent) {
      logger.error(`Error in ${context}:`, {
        error: normalizedError,
        details: normalizedError.details,
      });
    }

    // Additional handling based on error type
    if (normalizedError instanceof ApiError) {
      await this.handleApiError(normalizedError);
    } else if (normalizedError instanceof ValidationError) {
      await this.handleValidationError(normalizedError);
    } else if (normalizedError instanceof AuthenticationError) {
      await this.handleAuthError(normalizedError);
    }

    if (throwError) {
      throw normalizedError;
    }

    return normalizedError;
  }

  private static async handleApiError(error: ApiError): Promise<void> {
    // Handle specific API error status codes
    switch (error.status) {
      case 401:
        // Handle unauthorized - could trigger logout or token refresh
        this.handleUnauthorized();
        break;
      case 403:
        // Handle forbidden
        break;
      case 404:
        // Handle not found
        break;
      case 429:
        // Handle rate limiting
        await this.handleRateLimit(error);
        break;
      default:
        // Handle other status codes
        break;
    }
  }

  private static async handleValidationError(
    error: ValidationError
  ): Promise<void> {
    // Handle validation errors - could format messages for display
    logger.debug('Validation error details:', error.fields);
  }

  private static async handleAuthError(
    error: AuthenticationError
  ): Promise<void> {
    // Could trigger a logout or token refresh
    this.handleUnauthorized();
  }

  private static handleUnauthorized(): void {
    // Clear auth state and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('sessionId');
    window.location.href = '/login';
  }

  private static async handleRateLimit(error: ApiError): Promise<void> {
    // Could implement retry logic or user feedback
    const retryAfter = error.data?.retryAfter || 60;
    logger.warn(`Rate limited. Retry after ${retryAfter} seconds`);
  }

  static formatErrorMessage(error: unknown): string {
    if (error instanceof ValidationError && error.fields) {
      // Format validation error messages
      return Object.entries(error.fields)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('\n');
    }

    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'An unknown error occurred';
  }
}