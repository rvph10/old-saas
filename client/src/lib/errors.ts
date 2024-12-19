import { ErrorCode, ErrorCodes } from "./error-codes";

export class AppError extends Error {
  constructor(
    message: string,
    public code?: ErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ApiError extends AppError {
  constructor(
    message: string,
    public status: number,
    code?: ErrorCode,
    public data?: any
  ) {
    super(message, code);
    this.name = 'ApiError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message, ErrorCodes.VALIDATION.INVALID_INPUT, { fields });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, ErrorCodes.AUTH.INVALID_CREDENTIALS);
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed') {
    super(message, ErrorCodes.NETWORK_ERROR);
    this.name = 'NetworkError';
  }
}