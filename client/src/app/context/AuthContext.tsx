import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginCredentials, RegisterData, User } from '@/types/auth';
import { api } from '@/lib/api-client';
import { logger } from '@/lib/logger';

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
      const token = localStorage.getItem('token');
      const sessionId = localStorage.getItem('sessionId');

      if (!token || !sessionId) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const user = await api.get<User>('/auth/me');
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        sessionId,
      });
    } catch (error) {
      logger.error('Auth check failed', error);
      localStorage.removeItem('token');
      localStorage.removeItem('sessionId');
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
      
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('sessionId', response.sessionId);
      
      setState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
        sessionId: response.sessionId,
      });
  
      router.push('/dashboard');
    } catch (error) {
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
    } catch (error) {
      logger.error('Logout request failed', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('sessionId');
      setState({ user: null, isLoading: false, isAuthenticated: false });
      router.push('/login');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post<{ access_token: string; user: User }>('/auth/register', data);
      
      // After registration, automatically log in
      await login({
        username: data.username,
        password: data.password,
      });
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