import { ApiError, AuthenticationError, NetworkError } from '../errors';
import { logger } from '../logger';

export interface InterceptorConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
}

export class HttpInterceptor {
  private baseURL: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: InterceptorConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000; // Default 30s timeout
    this.maxRetries = config.retries || 2;
  }

  private async handleRequest(
    url: string,
    config: RequestConfig,
    retryCount = 0
  ): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const controller = new AbortController();
    const id = Math.random().toString(36).substring(7);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeout || this.timeout);

    try {
      // Add default headers
      const headers = new Headers(config.headers);
      if (!headers.has('Content-Type') && !(config.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      // Add security headers
      headers.set('X-Request-ID', id);
      headers.set('X-Client-Version', process.env.NEXT_PUBLIC_VERSION || '1.0.0');

      // Add auth token if it exists
      const token = localStorage.getItem('token');
      const sessionId = localStorage.getItem('sessionId');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (sessionId) headers.set('session-id', sessionId);

      // Log outgoing request
      logger.debug(`🌐 [${config.method}] ${fullUrl}`, {
        requestId: id,
        headers: Object.fromEntries(headers.entries()),
      });

      const response = await fetch(fullUrl, {
        ...config,
        headers,
        signal: controller.signal,
      });

      // Handle different response types
      if (response.ok) {
        return response;
      }

      // Handle specific error status codes
      switch (response.status) {
        case 401:
          throw new AuthenticationError('Authentication failed');
        case 429:
          if (retryCount < this.maxRetries) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            return this.handleRequest(url, config, retryCount + 1);
          }
          break;
      }

      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || 'Request failed',
        response.status,
        errorData.code,
        errorData
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }

      // Handle network errors with retry logic
      if (error instanceof Error && error.message.includes('network') && retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.handleRequest(url, config, retryCount + 1);
      }

      if (error instanceof Error) {
        throw new NetworkError(error.message);
      }
      throw new NetworkError('An unknown error occurred');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request<T>(url: string, config: RequestConfig = {}): Promise<T> {
    const response = await this.handleRequest(url, config);
    return response.json();
  }

  async get<T>(url: string, config: RequestConfig = {}): Promise<T> {
    return this.request(url, { ...config, method: 'GET' });
  }

  async post<T>(url: string, data?: unknown, config: RequestConfig = {}): Promise<T> {
    return this.request(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: unknown, config: RequestConfig = {}): Promise<T> {
    return this.request(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string, config: RequestConfig = {}): Promise<T> {
    return this.request(url, { ...config, method: 'DELETE' });
  }
}