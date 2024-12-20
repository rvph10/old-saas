'use client';

import { motion } from 'framer-motion';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center space-y-6"
        >
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{
              duration: 0.5,
              repeat: 3,
              repeatType: 'mirror',
            }}
          >
            <Icons.mail className="h-24 w-24 text-primary" />
          </motion.div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Verify Your Email
            </h1>
            <p className="text-muted-foreground">
              We've sent a verification link to your email address. 
              Please check your inbox (and spam folder) to confirm your account.
            </p>
          </div>

          <div className="flex flex-col space-y-4">
            <Button asChild>
              <Link href="/auth/login">
                Go to Login
              </Link>
            </Button>

            <p className="text-sm text-muted-foreground">
              Didn't receive an email? 
              <Button 
                variant="link" 
                className="p-0 pl-1"
                //TODO: Implement resend email functionality
              >
                Resend Verification
              </Button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}