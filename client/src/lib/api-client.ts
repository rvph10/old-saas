import { ApiError } from "./errors";
import { httpClient } from "./http/client";
import { logger } from "./logger";

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || '') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...init } = options;
    
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => 
        url.searchParams.append(key, value)
      );
    }

    // Add default headers
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Add auth token if it exists
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (sessionId) headers.set('session-id', sessionId);

    const response = await fetch(url.toString(), {
      ...init,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'An error occurred',
        response.status,
        error.code,
        error
      );
    }

    return response.json();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(
        error.message,
        response.status,
        error.code,
        error.details
      );
    }
    return response.json();
  }

  async get<T>(endpoint: string, config = {}): Promise<T> {
    try {
      return httpClient.get<T>(endpoint, config);
    } catch (error) {
      logger.error(`API GET request failed for ${endpoint}`, error);
      throw error;
    }
  }

  async post<T>(endpoint: string, data?: unknown, config = {}): Promise<T> {
    try {
      return httpClient.post<T>(endpoint, data, config);
    } catch (error) {
      logger.error(`API POST request failed for ${endpoint}`, error);
      throw error;
    }
  }

  async put<T>(endpoint: string, data?: unknown, config = {}): Promise<T> {
    try {
      return httpClient.put<T>(endpoint, data, config);
    } catch (error) {
      logger.error(`API PUT request failed for ${endpoint}`, error);
      throw error;
    }
  }

  async delete<T>(endpoint: string, config = {}): Promise<T> {
    try {
      return httpClient.delete<T>(endpoint, config);
    } catch (error) {
      logger.error(`API DELETE request failed for ${endpoint}`, error);
      throw error;
    }
  }
}

export const api = new ApiClient();