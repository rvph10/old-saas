'use client';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVerifyEmail } from '@/hooks/auth';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface VerifyTokenClientProps {
  token: string;
}

const VerifyTokenClient = ({ token }: VerifyTokenClientProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const verifyEmail = useVerifyEmail();
  const [verificationState, setVerificationState] = useState<
    'loading' | 'success' | 'error'
  >('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      try {
        await verifyEmail.mutateAsync(token);
        setVerificationState('success');
        toast({
          title: 'Email Verified',
          description: 'Your email has been successfully verified.',
          variant: 'success',
        });
      } catch (error: any) {
        setVerificationState('error');
        setErrorMessage(
          error.response?.data?.message ||
            'Verification failed. Please try again.',
        );
        toast({
          title: 'Verification Failed',
          description:
            error.response?.data?.message ||
            'Verification failed. Please try again.',
          variant: 'destructive',
        });
      }
    };

    verifyToken();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {verificationState === 'loading' && (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            <Icons.spinner className="h-12 w-12 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Verifying Email</h2>
            <p className="text-muted-foreground">
              Please wait while we verify your email address...
            </p>
          </motion.div>
        )}

        {verificationState === 'success' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Icons.check className="h-12 w-12 text-green-500" />
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Email Verified!</h2>
              <p className="text-muted-foreground">
                Thank you for verifying your email address. You can now login to
                your account.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/auth/login">Go to Login</Link>
            </Button>
          </motion.div>
        )}

        {verificationState === 'error' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Icons.x className="h-12 w-12 text-red-500" />
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Verification Failed</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button asChild variant="secondary">
                <Link href="/auth/verify-email/request">
                  Request New Verification
                </Link>
              </Button>
              <Button asChild>
                <Link href="/auth/login">Back to Login</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyTokenClient;
