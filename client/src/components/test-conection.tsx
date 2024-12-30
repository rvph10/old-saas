'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';

export function TestConnection() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await apiClient.get('/health');
        setStatus('success');
        setMessage(JSON.stringify(response.data, null, 2));
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unknown error');
        console.error('Connection test failed:', error);
      }
    };

    testConnection();
  }, []);

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 text-lg font-bold">Connection Test</h2>
      <div>
        Status: {status}
        {message && (
          <pre className="mt-2 rounded bg-gray-100 p-2">{message}</pre>
        )}
      </div>
    </div>
  );
}
