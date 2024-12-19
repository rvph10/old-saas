'use client';

interface VerificationResponse {
    message: string;
}

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.post<VerificationResponse>('/auth/verify-email', { token });
        setStatus('success');
        setMessage(response.message);
        
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } catch (error: unknown) {
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Failed to verify email';
        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Verifying your email...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className={`rounded-lg p-8 max-w-md w-full text-center ${
        status === 'success' ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <div className={`text-4xl mb-4 ${
          status === 'success' ? 'text-green-500' : 'text-red-500'
        }`}>
          {status === 'success' ? '✓' : '✗'}
        </div>
        <h1 className={`text-2xl font-bold mb-4 ${
          status === 'success' ? 'text-green-700' : 'text-red-700'
        }`}>
          {status === 'success' ? 'Email Verified!' : 'Verification Failed'}
        </h1>
        <p className={`mb-6 ${
          status === 'success' ? 'text-green-600' : 'text-red-600'
        }`}>
          {message}
        </p>
        {status === 'success' ? (
          <p className="text-gray-600">
            Redirecting to login page...
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              Try verifying your email again or contact support if the problem persists.
            </p>
            <Link 
              href="/auth/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}