import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/modules/auth/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/auth'];

const authMiddleware = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/'),
  );

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Only safe (navigational) methods go through auth(), which rolling-refreshes
  // the session cookie. Session-mutating requests (POST / Server Action,
  // including logout) skip auth() so a fresh token can't overwrite the deleting
  // Set-Cookie emitted by signOut on the Workers runtime.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return NextResponse.next();
  }
  // auth() types its handler like an App Route (expects a ctx with `params`),
  // but Next.js invokes middleware with a NextFetchEvent. The second argument is
  // unused by the auth wrapper anyway, so we cast it to the expected call type.
  return authMiddleware(
    req,
    event as unknown as Parameters<typeof authMiddleware>[1],
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
