export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly details?: any,
    public readonly context?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      context: this.context,
    };
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

export class PasswordValidationError extends AppError {
  constructor(errors: string[]) {
    super(
      'Password validation failed',
      'PASSWORD_VALIDATION_ERROR',
      400,
      errors,
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'VALIDATION_ERROR', 400, details, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, details, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'AUTHORIZATION_ERROR', 403, details, context);
  }
}

export class SessionError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'SESSION_ERROR', 401, details, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'RATE_LIMIT_ERROR', 429, details, context);
  }
}

export class TwoFactorError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'TWO_FACTOR_ERROR', 401, details, context);
  }
}

export class AccountError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, 'ACCOUNT_ERROR', 403, details, context);
  }
}
