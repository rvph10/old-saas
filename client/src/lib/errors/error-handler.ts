import axios, { AxiosError } from 'axios';
import { toast } from '@/hooks/use-toast';
import { ApiError, ApiErrorResponse } from './api-errors';

export class ErrorHandler {
  private static readonly ERROR_MESSAGES = {
    NETWORK_ERROR:
      'Unable to connect to the server. Please check your internet connection.',
    TIMEOUT_ERROR: 'The request timed out. Please try again.',
    SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
    UNAUTHORIZED: 'Your session has expired. Please log in again.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION_ERROR: 'Please check your input and try again.',
  };

  private static readonly ERROR_CODES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
  };

  static handleError(error: unknown): ApiErrorResponse {
    if (error instanceof ApiError) {
      return error.toResponse();
    }

    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error);
    }

    return {
      code: this.ERROR_CODES.SERVER_ERROR,
      message: this.ERROR_MESSAGES.SERVER_ERROR,
      timestamp: new Date().toISOString(),
    };
  }

  private static handleAxiosError(error: AxiosError): ApiErrorResponse {
    // Network error
    if (!error.response) {
      return {
        code: this.ERROR_CODES.NETWORK_ERROR,
        message: this.ERROR_MESSAGES.NETWORK_ERROR,
        timestamp: new Date().toISOString(),
      };
    }

    // Timeout error
    if (error.code === 'ECONNABORTED') {
      return {
        code: this.ERROR_CODES.TIMEOUT_ERROR,
        message: this.ERROR_MESSAGES.TIMEOUT_ERROR,
        timestamp: new Date().toISOString(),
      };
    }

    // Server error responses
    const status = error.response.status;
    const data = error.response.data as any;

    switch (status) {
      case 401:
        return {
          code: this.ERROR_CODES.UNAUTHORIZED,
          message: data?.message || this.ERROR_MESSAGES.UNAUTHORIZED,
          details: data?.details,
          timestamp: new Date().toISOString(),
        };
      case 403:
        return {
          code: this.ERROR_CODES.FORBIDDEN,
          message: data?.message || this.ERROR_MESSAGES.FORBIDDEN,
          details: data?.details,
          timestamp: new Date().toISOString(),
        };
      case 404:
        return {
          code: this.ERROR_CODES.NOT_FOUND,
          message: data?.message || this.ERROR_MESSAGES.NOT_FOUND,
          details: data?.details,
          timestamp: new Date().toISOString(),
        };
      case 422:
        return {
          code: this.ERROR_CODES.VALIDATION_ERROR,
          message: data?.message || this.ERROR_MESSAGES.VALIDATION_ERROR,
          details: data?.details,
          timestamp: new Date().toISOString(),
        };
      default:
        return {
          code: this.ERROR_CODES.SERVER_ERROR,
          message: data?.message || this.ERROR_MESSAGES.SERVER_ERROR,
          details: data?.details,
          timestamp: new Date().toISOString(),
        };
    }
  }

  static showErrorToast(error: ApiErrorResponse) {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  }
}
