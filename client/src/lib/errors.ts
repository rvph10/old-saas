export class AppError extends Error {
    constructor(
      message: string,
      public code?: string,
      public details?: any
    ) {
      super(message);
      this.name = 'AppError';
      Object.setPrototypeOf(this, AppError.prototype);
    }
  }
  
  export class ApiError extends AppError {
    constructor(
      message: string,
      public status: number,
      code?: string,
      public data?: any
    ) {
      super(message, code, data);
      this.name = 'ApiError';
      Object.setPrototypeOf(this, ApiError.prototype);
    }
  }
  
  export class ValidationError extends AppError {
    constructor(message: string, public fields?: Record<string, string[]>) {
      super(message, 'VALIDATION_ERROR', { fields });
      this.name = 'ValidationError';
      Object.setPrototypeOf(this, ValidationError.prototype);
    }
  }
  
  export class AuthenticationError extends ApiError {
    constructor(message: string = 'Authentication failed') {
      super(message, 401, 'AUTH_ERROR');
      this.name = 'AuthenticationError';
      Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
  }
  
  export class NetworkError extends AppError {
    constructor(message: string = 'Network request failed') {
      super(message, 'NETWORK_ERROR');
      this.name = 'NetworkError';
      Object.setPrototypeOf(this, NetworkError.prototype);
    }
  }