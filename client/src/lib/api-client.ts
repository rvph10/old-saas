import axios, {
  AxiosHeaders,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { ErrorHandler } from './errors/error-handler';

export interface AuthResponse {
  user?: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  sessionId?: string;
  requires2FA?: boolean;
  tempToken?: string;
}

interface CustomRequestConfig extends AxiosRequestConfig {
  showError?: boolean;
}

const TIMEOUT_DURATION = 10000;

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Credentials': 'true',
  },
  withCredentials: true,
  timeout: TIMEOUT_DURATION,
  timeoutErrorMessage: 'Request timed out',
});

const clearAuthState = () => {
  localStorage.removeItem('sessionId');
  const cookies = ['access_token', 'refresh_token', 'csrf_token'];
  cookies.forEach((cookie) => {
    document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
};

// Request interceptor
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Initialize headers as AxiosHeaders if not exist
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }

    // Set default headers
    config.headers.set('Content-Type', 'application/json');
    config.headers.set('Access-Control-Allow-Credentials', 'true');

    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf_token='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers.set('x-csrf-token', csrfToken);
    }

    // Add session ID from storage if available
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      config.headers.set('session-id', sessionId);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Request:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  },
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });
    }
    return response;
  },
  async (error) => {
    const errorResponse = ErrorHandler.handleError(error);

    // Show toast for user-facing errors
    if (error.config?.showError !== false) {
      ErrorHandler.showErrorToast(errorResponse);
    }

    return Promise.reject(errorResponse);
  },
);

// Auth API
export const authApi = {
  login: async (credentials: {
    username: string;
    password: string;
  }): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post<AuthResponse>(
        '/auth/login',
        credentials,
      );

      if (response.data.sessionId) {
        localStorage.setItem('sessionId', response.data.sessionId);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const serverErrorMessage = error.response?.data?.message;
        throw new Error(serverErrorMessage || 'Login failed');
      }
      throw error;
    }
  },

  register: async (data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    console.log('Registering:', data);
    return apiClient.post('/auth/register', data);
  },

  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      localStorage.removeItem('sessionId');
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  refreshToken: async () => {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/refresh', {}, {
        headers: {
          'x-skip-csrf': 'true',
        },
        showError: false,
      } as CustomRequestConfig);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        clearAuthState();
      }
      throw error;
    }
  },

  verifyEmail: async (token: string) => {
    try {
      const response = await apiClient.post('/auth/verify-email', { token });
      return response.data;
    } catch (error) {
      console.error('Verification failed: ' + error);
      throw error;
    }
  },

  resendVerification: async (email: string) =>
    apiClient.post('/auth/resend-verification', { email }),

  getCurrentUser: async () => apiClient.get('/auth/me'),

  requestPasswordReset: async (email: string) =>
    apiClient.post('/auth/password-reset/request', { email }),

  resetPassword: async (token: string, password: string, headers: any = {}) =>
    apiClient.post(
      '/auth/password-reset/reset',
      { token, password },
      { headers },
    ),

  terminateSession: async (sessionId: string) =>
    apiClient.delete(`/auth/sessions/${sessionId}`),

  logoutAllDevices: async (keepCurrentSession: boolean = false) =>
    apiClient.post('/auth/logout-all', {
      keepCurrentSession,
    }),
  getSessions: async () => apiClient.get('/auth/sessions'),

  blockAccount: async (accountId: string) =>
    apiClient.post('/auth/block', { accountId }),

  extend2FASession: async (token: string) =>
    apiClient.post('/auth/2fa/verify', { token }),

  getCsrfToken: async () => apiClient.get('/auth/csrf-token'),
};

export default apiClient;
