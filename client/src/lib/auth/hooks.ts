import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../http/api-client';
import { useRouter } from 'next/navigation';

interface AuthError {
  message: string;
}

export function useAuth() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isAuthenticated = status === 'authenticated' && !!session;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        return false;
      }
      return true;
    } catch (err) {
      const error = err as AuthError;
      setError(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call backend logout if we have a session
      if (session?.sessionId) {
        try {
          await apiClient.post('/auth/logout', {}, {
            headers: {
              'session-id': session.sessionId,
            },
          });
        } catch (err) {
          console.error('Backend logout error:', err);
          // Continue with frontend logout even if backend fails
        }
      }

      // Front-end logout
      await signOut({
        callbackUrl: '/login',
        redirect: true
      });

      // Force router navigation if signOut doesn't redirect
      router.push('/login');
    } catch (err) {
      const error = err as AuthError;
      setError(error.message);
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.post('/auth/register', userData);
      return login(userData.username, userData.password);
    } catch (err) {
      const error = err as AuthError;
      setError(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    isAuthenticated,
    isLoading: status === 'loading' || loading,
    error,
    login,
    logout,
    register,
  };
}