import { ResetPasswordForm } from '@/components/auth/reset-password-form';

type Props = {
  params: { token: string };
};

export default function ResetPasswordPage({ params }: Props) {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <ResetPasswordForm token={params.token} />
    </div>
  );
}
