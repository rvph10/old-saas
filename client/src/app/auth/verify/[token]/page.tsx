import VerifyTokenClient from "@/components/auth/verify-token-client";

type Props = {
  params: { token: string }
}

export default async function VerifyTokenPage({ params }: Props) {
  return <VerifyTokenClient token={params.token} />;
}