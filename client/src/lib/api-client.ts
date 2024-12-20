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
  },
  withCredentials: true,
  timeout: TIMEOUT_DURATION,
});

// Request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('sessionId');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (sessionId) {
      config.headers['session-id'] = sessionId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest?.headers['x-retry']
    ) {
      // Clear auth state
      localStorage.removeItem('access_token');
      localStorage.removeItem('sessionId');

      // Redirect to login
      //window.location.href = '/auth/login';
      return Promise.reject(error);
    }

    return Promise.reject(error);
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
      const { access_token, sessionId } = response.data;

      // Store auth data
      if (access_token) {
        localStorage.setItem('access_token', access_token);
      }
      if (sessionId) {
        localStorage.setItem('sessionId', sessionId);
      }

      return response.data;
    } catch (error) {
      // More detailed error handling
      if (axios.isAxiosError(error)) {
        // Specific error details from server
        const serverErrorMessage = error.response?.data?.message;

        console.error('Login API error:', {
          serverMessage: serverErrorMessage,
          status: error.response?.status,
          fullError: error,
        });

        // Throw a more informative error
        throw new Error(serverErrorMessage || 'Login failed');
      }

      // Generic error
      console.error('Unexpected login error:', error);
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
    const {confirmPassword, ...apiData} = data;
    return apiClient.post('/auth/register', apiData);
  },

  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      // Clear auth data
      localStorage.removeItem('access_token');
      localStorage.removeItem('sessionId');
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  verifyEmail: async (token: string) => {
    return apiClient.post('/auth/verify-email', { token });
  },

  getCurrentUser: async () => {
    return apiClient.get('/auth/me');
  },

  requestPasswordReset: async (email: string) => {
    return apiClient.post('/auth/password-reset/request', { email });
  },

  resetPassword: async (token: string, password: string) => {
    return apiClient.post('/auth/password-reset/reset', { token, password });
  },

  getSessions: async () => {
    return apiClient.get('/auth/sessions');
  },

  terminateSession: async (sessionId: string) => {
    return apiClient.delete(`/auth/sessions/${sessionId}`);
  },

  logoutAllDevices: async (keepCurrentSession: boolean = false) => {
    return apiClient.delete('/auth/logout-all', {
      data: { keepCurrentSession },
    });
  },
};

export default apiClient;
