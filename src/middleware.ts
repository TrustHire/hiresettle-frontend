import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/auth/login'];

/**
 * Decode the `exp` claim from a JWT without verifying the signature.
 * Safe for edge runtime — uses only built-ins.
 * Returns the expiry timestamp in seconds, or null when it cannot be read.
 */
function getJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Edge runtime supports atob
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = request.cookies.get('hiresettle_token')?.value;

  const redirectToLogin = () => {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  };

  // No cookie → redirect
  if (!token && !pathname.startsWith('/auth')) {
    return redirectToLogin();
  }

  // Cookie present but JWT is expired → redirect
  if (token) {
    const exp = getJwtExp(token);
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp !== null && exp < nowSec) {
      // Expire the stale cookie while redirecting
      const response = redirectToLogin();
      response.cookies.set('hiresettle_token', '', { path: '/', maxAge: 0 });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|public).*)'],
};
