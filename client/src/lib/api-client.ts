// src/lib/api-client.ts
import axios from 'axios';
import { getSession } from 'next-auth/react';
import { Session } from 'next-auth';

interface LoginResponse {
  accessToken: string;
  sessionId: string;
  user: Session['user'];
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const session = await getSession();
      
      if (session?.accessToken) {
        config.headers['Authorization'] = `Bearer ${session.accessToken}`;
      }
      
      // Add session ID if available
      if (typeof window !== 'undefined') {
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
          config.headers['session-id'] = sessionId;
        }
      }

      return config;
    } catch (error) {
      return Promise.reject(error);
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear session and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sessionId');
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: { 
    username: string; 
    password: string; 
  }): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    if (response.data.sessionId && typeof window !== 'undefined') {
      localStorage.setItem('sessionId', response.data.sessionId);
    }
    return response.data;
  },

  register: async (data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<ApiResponse<void>> => {
    return apiClient.post('/auth/register', data);
  },

  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sessionId');
    }
    return response.data;
  },

  verifyEmail: async (token: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post('/auth/verify-email', { token });
  },

  requestPasswordReset: async (email: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post('/auth/password-reset/request', { email });
  },

  resetPassword: async (token: string, password: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post('/auth/password-reset/reset', { token, password });
  },

  getCurrentUser: async (): Promise<ApiResponse<Session['user']>> => {
    return apiClient.get('/auth/me');
  },

  getSessions: async (): Promise<ApiResponse<string[]>> => {
    return apiClient.get('/auth/sessions');
  },

  terminateSession: async (sessionId: string): Promise<ApiResponse<void>> => {
    return apiClient.delete(`/auth/sessions/${sessionId}`);
  },

  logoutAllDevices: async (keepCurrentSession: boolean = false): Promise<ApiResponse<{
    message: string;
    sessionsTerminated: number;
  }>> => {
    return apiClient.delete('/auth/logout-all', {
      data: { keepCurrentSession },
    });
  },
};

export default apiClient;