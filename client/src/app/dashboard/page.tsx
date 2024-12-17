'use client';

import { useAuth } from '@/lib/auth/hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { session, isAuthenticated, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
    console.log('Auth State:', {
      isLoading,
      isAuthenticated,
      hasSession: !!session,
      status
    });
  }, [isLoading, isAuthenticated, session, router]);

  // While loading or no session, show loading state
  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400"
            >
              {isLoading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
          
          <div className="mt-6">
            <h2 className="text-lg font-semibold">User Information</h2>
            <div className="mt-4 space-y-2">
              <p><span className="font-medium">Username:</span> {session.user.username}</p>
              <p><span className="font-medium">Email:</span> {session.user.email}</p>
              <p><span className="font-medium">ID:</span> {session.user.id}</p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold">Session Information</h2>
            <div className="mt-4 space-y-2">
              <p><span className="font-medium">Session ID:</span> {session.sessionId}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}