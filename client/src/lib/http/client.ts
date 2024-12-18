import { HttpInterceptor, InterceptorConfig } from './interceptors';
import { logger } from '../logger';

interface RetryConfig {
  retries: number;
  retryDelay: number;
}

class HttpClient {
  private interceptor: HttpInterceptor;
  private retryConfig: RetryConfig;

  constructor(
    config: InterceptorConfig,
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.interceptor = new HttpInterceptor(config);
    this.retryConfig = {
      retries: retryConfig.retries || 2,
      retryDelay: retryConfig.retryDelay || 1000,
    };
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.retryConfig.retries && this.shouldRetry(error)) {
        logger.warn(`Retrying request (${retryCount + 1}/${this.retryConfig.retries})`);
        await new Promise(resolve => 
          setTimeout(resolve, this.retryConfig.retryDelay * (retryCount + 1))
        );
        return this.executeWithRetry(operation, retryCount + 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Add conditions for retrying requests
    return (
      error.name === 'NetworkError' ||
      error.status === 429 ||
      error.status >= 500
    );
  }

  async get<T>(url: string, config = {}): Promise<T> {
    return this.executeWithRetry(() => this.interceptor.get<T>(url, config));
  }

  async post<T>(url: string, data?: unknown, config = {}): Promise<T> {
    return this.executeWithRetry(() => this.interceptor.post<T>(url, data, config));
  }

  async put<T>(url: string, data?: unknown, config = {}): Promise<T> {
    return this.executeWithRetry(() => this.interceptor.put<T>(url, data, config));
  }

  async delete<T>(url: string, config = {}): Promise<T> {
    return this.executeWithRetry(() => this.interceptor.delete<T>(url, config));
  }
}

// Create and export a singleton instance
export const httpClient = new HttpClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  timeout: 30000,
  retries: 2,
});