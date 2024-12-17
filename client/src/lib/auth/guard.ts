import { getSession } from 'next-auth/react';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  const session = await getSession({ req: request as any });

  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return handler(request);
}