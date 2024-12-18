'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginCredentials, RegisterData, User } from '@/types/auth';
import { api } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import { toastService } from '@/lib/toast';

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
      
      // Set token as a cookie
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
      logger.error('Login failed', error);
      toastService.error('Login failed. Please check your credentials.');
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