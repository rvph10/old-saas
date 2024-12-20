'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Icons } from '../icons';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useResendVerification } from '@/hooks/auth';

const requestVerificationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type RequestVerificationInput = z.infer<typeof requestVerificationSchema>;

export function RequestVerificationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const resendVerification = useResendVerification();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RequestVerificationInput>({
    resolver: zodResolver(requestVerificationSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(data: RequestVerificationInput) {
    try {
      setIsLoading(true);
      await resendVerification.mutateAsync(data.email);

      toast({
        title: 'Verification Email Sent',
        description: 'Please check your email for the verification link.',
        variant: 'success',
      });

      // Redirect to verification pending page
      router.push('/auth/verify-email');
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        'Failed to send verification email. Please try again.';

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Resend Verification Email
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email address to receive a new verification link
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your email"
                    type="email"
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isLoading ? 'Sending...' : 'Send Verification Email'}
          </Button>
        </form>
      </Form>

      <div className="text-center text-sm">
        <Link href="/auth/login" className="text-primary hover:underline">
          Back to Login
        </Link>
      </div>
    </div>
  );
}