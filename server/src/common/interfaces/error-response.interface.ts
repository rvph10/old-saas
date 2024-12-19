export interface ErrorResponse {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path?: string;
  }