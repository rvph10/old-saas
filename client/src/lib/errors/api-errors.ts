export interface ApiErrorResponse {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path?: string;
  }
  
  export class ApiError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly details?: Record<string, any>,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  
    toResponse(): ApiErrorResponse {
      return {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString(),
      };
    }
  }