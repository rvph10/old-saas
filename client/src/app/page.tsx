'use client';

import { LoggerProvider } from '@/components/providers/logger-provider';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TestConnection } from '@/components/test-conection';

const features = [
  {
    title: 'Order Management',
    description: 'Streamline your order processing and delivery tracking',
    icon: '🍽️',
  },
  {
    title: 'Table Management',
    description: 'Efficiently manage reservations and seating arrangements',
    icon: '📋',
  },
  {
    title: 'Inventory Control',
    description: 'Track stock levels and manage suppliers in real-time',
    icon: '📦',
  },
  {
    title: 'Staff Scheduling',
    description: 'Organize staff shifts and manage employee performance',
    icon: '👥',
  },
];

export default function HomePage() {
  return (
    <LoggerProvider componentName="HomePage">
      <div className="flex min-h-screen flex-col">
        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <span className="text-2xl font-bold">Nibblix</span>
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative">
          <div className="container mx-auto px-4 py-32 text-center">
            <h1 className="mb-8 text-4xl font-bold tracking-tight sm:text-6xl">
              Manage Your Restaurant{' '}
              <span className="text-primary">with Confidence</span>
            </h1>
            <p className="mx-auto mb-12 max-w-2xl text-lg text-muted-foreground">
              Everything you need to run your restaurant efficiently - from
              order management to staff scheduling, all in one place.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/auth/register">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-slate-50 py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Everything You Need
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg bg-white p-6 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="mb-4 text-3xl">{feature.icon}</div>
                  <h3 className="mb-2 text-xl font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-12">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} Nibblix. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
      <TestConnection />
    </LoggerProvider>
  );
}
