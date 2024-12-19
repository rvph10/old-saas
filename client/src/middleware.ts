// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for token in Authorization header or as a Bearer token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1] || 
                request.cookies.get('token')?.value;

  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isPublicPage = request.nextUrl.pathname === '/';
  const isStaticAsset = request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg)$/);
  if (isStaticAsset) {
    return NextResponse.next();
  }
  // Allow public pages without authentication
  if (isPublicPage) {
    return NextResponse.next();
  }
  // Protect API routes
  if (isApiRoute && !token) {
    return NextResponse.json(
      { message: 'Authentication required' },
      { status: 401 }
    );
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!isAuthPage && !token && !isApiRoute) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};