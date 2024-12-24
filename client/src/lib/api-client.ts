import axios, { AxiosError } from 'axios';

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  sessionId: string;
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
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('sessionId');

    config.headers = config.headers || {};

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (sessionId) {
      config.headers['session-id'] = sessionId;
    }

    // Add CORS headers
    config.headers['Access-Control-Allow-Credentials'] = 'true';

    // Log requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', {
        method: config.method,
        url: config.url,
        data: config.data,
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
      throw new Error('Request timeout: Server is not responding');
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error);
      throw new Error('Network error: Please check your connection');
    }

    // Handle 401 errors (unauthorized)
    if (
      error.response?.status === 401 &&
      error.config &&
      !error.config?.headers['x-retry']
    ) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('sessionId');
    }

    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        config: error.config,
      });
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: {
    username: string;
    password: string;
  }): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      const { access_token, sessionId } = response.data;

      if (access_token) localStorage.setItem('access_token', access_token);
      if (sessionId) localStorage.setItem('sessionId', sessionId);

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
    confirmPassword: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    const { confirmPassword, ...apiData } = data;
    return apiClient.post('/auth/register', apiData);
  },

  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      localStorage.removeItem('access_token');
      localStorage.removeItem('sessionId');
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  verifyEmail: async (token: string) => 
    apiClient.post('/auth/verify-email', { token }),

  getCurrentUser: async () => 
    apiClient.get('/auth/me'),

  requestPasswordReset: async (email: string) => 
    apiClient.post('/auth/password-reset/request', { email }),

  resetPassword: async (token: string, password: string) => 
    apiClient.post('/auth/password-reset/reset', { token, password }),

  resendVerification: async (email: string) => 
    apiClient.post('/auth/resend-verification', { email }),

  getSessions: async () => 
    apiClient.get('/auth/sessions'),

  terminateSession: async (sessionId: string) => 
    apiClient.delete(`/auth/sessions/${sessionId}`),

  logoutAllDevices: async (keepCurrentSession: boolean = false) => 
    apiClient.delete('/auth/logout-all', {
      data: { keepCurrentSession },
    }),
};

export default apiClient;