export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly details?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
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
      errors
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
  }
}
