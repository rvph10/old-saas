'use client';

import { LoggerProvider } from '@/components/providers/logger-provider';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <LoggerProvider componentName="HomePage">
      <div className="flex min-h-screen flex-col">
        {/* Navigation */}
        <header className="border-b">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <span className="text-2xl font-bold">Nibblix</span>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-sm font-medium hover:text-gray-600"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Get Started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1">
          <section className="container mx-auto px-4 py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-5xl font-bold tracking-tight">
                Manage Your Restaurant with Ease
              </h1>
              <p className="mt-6 text-lg text-gray-600">
                Streamline your operations, boost efficiency, and enhance
                customer experience with our comprehensive restaurant management
                system.
              </p>
              <div className="mt-10 flex justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="flex items-center gap-2 rounded-md bg-black px-6 py-3 font-medium text-white hover:bg-gray-800"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </LoggerProvider>
  );
}
