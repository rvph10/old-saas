'use client';

import React from 'react';
import { useAuth } from '../../app/context/AuthContext';
import Link from 'next/link';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link 
              href="/dashboard"
              className="flex items-center text-gray-800 dark:text-white font-bold text-xl"
            >
              Nibblix
            </Link>
          </div>

          <div className="flex items-center">
            <div className="relative ml-3">
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 dark:text-gray-300">
                  {user?.username}
                </span>
                <button
                  onClick={() => logout()}
                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}