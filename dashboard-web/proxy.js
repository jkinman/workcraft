import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/api/health']);
const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const protectedProxy = clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  await auth.protect();
  return NextResponse.next();
});

export default isClerkConfigured
  ? protectedProxy
  : function proxy() {
    return NextResponse.next();
  };

export const config = {
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/api/(.*)'
  ]
};
