import VerifyTokenClient from '../../../../components/auth/verify-token-client';

export default function VerifyTokenPage({
  params,
}: {
  params: { token: string };
}) {
  return <VerifyTokenClient token={params.token} />;
}