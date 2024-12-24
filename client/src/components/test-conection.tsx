'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';

export function TestConnection() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
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
    <div className="p-4 border rounded">
      <h2 className="text-lg font-bold mb-2">Connection Test</h2>
      <div>
        Status: {status}
        {message && (
          <pre className="mt-2 p-2 bg-gray-100 rounded">
            {message}
          </pre>
        )}
      </div>
    </div>
  );
}