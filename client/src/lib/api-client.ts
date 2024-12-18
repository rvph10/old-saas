import { ApiError } from "./errors";
import { httpClient } from "./http/client";

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

  async get<T>(endpoint: string, config = {}): Promise<T> {
    return httpClient.get<T>(endpoint, config);
  }

  async post<T>(endpoint: string, data?: unknown, config = {}): Promise<T> {
    return httpClient.post<T>(endpoint, data, config);
  }

  async put<T>(endpoint: string, data?: unknown, config = {}): Promise<T> {
    return httpClient.put<T>(endpoint, data, config);
  }

  async delete<T>(endpoint: string, config = {}): Promise<T> {
    return httpClient.delete<T>(endpoint, config);
  }
}

export const api = new ApiClient();