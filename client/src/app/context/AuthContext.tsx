'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginCredentials, RegisterData, User } from '@/types/auth';
import { api } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import { toastService } from '@/lib/toast';
import { ApiError } from '@/lib/errors';
import { ErrorCode, ErrorCodes } from '@/lib/error-codes';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionId?: string;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await api.get<User>('/auth/me');
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      logger.error('Auth check failed', error);
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await api.post<{ 
        access_token: string; 
        sessionId: string; 
        user: User 
      }>('/auth/login', credentials);
      
      document.cookie = `token=${response.access_token}; path=/; max-age=${24*60*60}`;
      
      setState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
        sessionId: response.sessionId,
      });
    
      toastService.success('Successfully logged in!');
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code) {
          switch (error.code) {
            case ErrorCodes.AUTH.EMAIL_NOT_VERIFIED as ErrorCode:
              toastService.error('Please verify your email before logging in.');
              break;
            case ErrorCodes.AUTH.INVALID_CREDENTIALS as ErrorCode:
              toastService.error('Invalid username or password.');
              break;
            case ErrorCodes.AUTH.ACCOUNT_LOCKED as ErrorCode:
              toastService.error(
                `Account temporarily locked. ${
                  error.data?.remainingMinutes 
                    ? `Try again in ${error.data.remainingMinutes} minutes.`
                    : ''
                }`
              );
              break;
            default:
              toastService.error(error.message);
          }
        } else {
          toastService.error(error.message);
        }
      }
      logger.error('Login failed', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await api.post('/auth/logout', { sessionId });
      }
      toastService.success('Successfully logged out');
    } catch (error) {
      logger.error('Logout request failed', error);
      toastService.error('Error during logout');
    } finally {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setState({ user: null, isLoading: false, isAuthenticated: false });
      router.push('/login');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post<{ access_token: string; user: User }>('/auth/register', data);
    } catch (error) {
      logger.error('Registration failed', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};