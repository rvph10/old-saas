'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { EmailResendResponse } from '@/types/api';

export function ResendVerificationEmail({ email }: { email: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    if (cooldown > 0 || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await api.post<EmailResendResponse>('/auth/resend-verification', { email });
      showToast(response.message, 'success');
      // Start cooldown
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to resend verification email';
        showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleResend}
      disabled={isLoading || cooldown > 0}
      className="text-blue-600 hover:text-blue-500 disabled:text-gray-400"
    >
      {cooldown > 0
        ? `Resend in ${cooldown}s`
        : isLoading
        ? 'Sending...'
        : 'Resend verification email'}
    </button>
  );
}