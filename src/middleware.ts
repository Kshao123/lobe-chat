import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { appEnv } from '@/config/app';
import { authEnv } from '@/config/auth';
import NextAuthEdge from '@/libs/next-auth/edge';

import { OAUTH_AUTHORIZED } from './const/auth';

export const config = {
  matcher: [
    // include any files in the api or trpc folders that might have an extension
    '/(api|trpc|webapi)(.*)',
    // include the /
    '/',
    '/chat(.*)',
    '/settings(.*)',
    '/files(.*)',
    '/repos(.*)',
    // ↓ cloud ↓
  ],
};

const defaultMiddleware = () => NextResponse.next();

// Initialize an Edge compatible NextAuth middleware
const nextAuthMiddleware = NextAuthEdge.auth((req) => {
  // skip the '/' route
  if (req.nextUrl.pathname === '/') return NextResponse.next();

  // Just check if session exists
  const session = req.auth;

  // Check if next-auth throws errors
  // refs: https://github.com/lobehub/lobe-chat/pull/1323
  const isLoggedIn = !!session?.expires;

  // Remove & amend OAuth authorized header
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(OAUTH_AUTHORIZED);
  if (isLoggedIn) requestHeaders.set(OAUTH_AUTHORIZED, 'true');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

const isProtectedRoute = createRouteMatcher([
  '/settings(.*)',
  '/files(.*)',
  // ↓ cloud ↓
]);

// 自有功能
const clerkNextMiddleware = clerkMiddleware(
  (auth, req) => {
    if (isProtectedRoute(req)) auth().protect();
  },
  {
    // https://github.com/lobehub/lobe-chat/pull/3084
    clockSkewInMs: 60 * 60 * 1000,

    // 自有功能
    // debug: true,
    domain: appEnv.APP_URL,

    signInUrl: '/login',
    signUpUrl: '/signup',
  },
);

// 自有功能
const beforeClerkAuthMiddleware = (request: NextRequest, ...args: any) => {
  // Clone the request headers and set a new header `x-hello-from-middleware1`
  // const requestHeaders = new Headers(request.headers)
  request.headers.set('x-forwarded-host', process.env.HOST!);

  // @ts-ignore
  return clerkNextMiddleware(request, ...args);
};

export default authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH
  ? beforeClerkAuthMiddleware
  : authEnv.NEXT_PUBLIC_ENABLE_NEXT_AUTH
    ? nextAuthMiddleware
    : defaultMiddleware;
