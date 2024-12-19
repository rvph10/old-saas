'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';
import Link from 'next/link';
import { ApiError } from '@/lib/errors';
import { PasswordRequirements } from './PasswordRequirements';
import { ErrorCode, ErrorCodes } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

export function RegisterForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
  
    try {
      await register(formData);
      showToast('Registration successful! Please check your email to verify your account.', 'success');
      router.push('/auth/login');
    } catch (error) {
      if (error instanceof ApiError && error.code) {
        switch (error.code) {
          case ErrorCodes.VALIDATION.INVALID_PASSWORD as ErrorCode:
            showToast(
              error.data?.errors?.join('\n') || 'Password validation failed',
              'error'
            );
            console.log(error.data.errors[0]);
            if (error.data?.errors) {
            }
            break;
          case ErrorCodes.ACCOUNT.ALREADY_EXISTS as ErrorCode:
            showToast('An account with this email or username already exists', 'error');
            break;
          default:
            showToast(error.message, 'error');
        }
      } else {
        showToast('Failed to register', 'error');
      }
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            First Name
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Last Name
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Username
        </label>
        <input
          type="text"
          id="username"
          name="username"
          required
          autoComplete="username"
          value={formData.username}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          onFocus={() => setShowPasswordRequirements(true)}
          onBlur={() => setShowPasswordRequirements(false)}
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        {showPasswordRequirements && (
    <PasswordRequirements password={formData.password} />
  )}
      </div>

      <div className="text-sm">
        <Link href="/auth/login" className="text-blue-600 hover:text-blue-500">
          Already have an account?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}