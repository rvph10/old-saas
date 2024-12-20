'use client';

import { useEffect, useRef, useState } from 'react';
import { useVerifyEmail } from '@/hooks/auth';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type VerificationState = 'verifying' | 'success' | 'error';

export default function VerifyTokenClient({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const verifyEmail = useVerifyEmail();
  const [verificationState, setVerificationState] = useState<VerificationState>('verifying');
  const verificationAttempted = useRef(false);

  useEffect(() => {
    const verifyToken = async () => {
        if (verificationAttempted.current) return;
      
      verificationAttempted.current = true;
      try {
        await verifyEmail.mutateAsync(token);
        setVerificationState('success');
        toast({
          title: 'Email Verified',
          description: 'Your email has been successfully verified.',
          variant: 'success',
        });
      } catch (error) {
        setVerificationState('error');
        toast({
          title: 'Verification Failed',
          description:
            'Unable to verify your email. The link may have expired or is invalid.',
          variant: 'destructive',
        });
      }
    };

    verifyToken();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center space-y-6"
        >
          {verificationState === 'verifying' && (
            <>
              <Icons.spinner className="h-16 w-16 animate-spin text-primary" />
              <h1 className="text-2xl font-bold">Verifying your email...</h1>
              <p className="text-muted-foreground">
                Please wait while we verify your email address.
              </p>
            </>
          )}

          {verificationState === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                }}
              >
                <Icons.check className="h-16 w-16 text-green-500" />
              </motion.div>
              <h1 className="text-2xl font-bold text-green-600">
                Email Verified!
              </h1>
              <p className="text-muted-foreground">
                Your email has been successfully verified. You can now sign in to
                your account.
              </p>
              <Button asChild className="w-full">
                <Link href="/auth/login">Continue to Login</Link>
              </Button>
            </>
          )}

          {verificationState === 'error' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                }}
              >
                <Icons.x className="h-16 w-16 text-red-500" />
              </motion.div>
              <h1 className="text-2xl font-bold text-red-600">
                Verification Failed
              </h1>
              <p className="text-muted-foreground">
                The verification link may have expired or is invalid. Please try
                requesting a new verification email.
              </p>
              <div className="flex w-full flex-col gap-2">
                <Button asChild variant="outline">
                  <Link href="/auth/verify-email/request">Request New Link</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/auth/login">Back to Login</Link>
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}