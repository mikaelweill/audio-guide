import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Create a Supabase client configured to use cookies
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });
  
  // Get the pathname from the URL
  const { pathname } = request.nextUrl;
  console.log(`Middleware processing route: ${pathname}`);
  
  // Routes that don't require authentication
  const publicRoutes = ['/login', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Special handling for the root path
  const isRootPath = pathname === '/';
  
  try {
    // Refresh session if expired - required for SSR
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Middleware auth error:', error);
    }
    
    // Check if the user is authenticated
    const isAuthenticated = !!session?.user;
    console.log(`Middleware auth check: ${isAuthenticated ? 'Authenticated' : 'Not authenticated'}, User: ${session?.user?.email || 'none'}`);
    
    // If the route requires authentication and the user is not authenticated, redirect to login
    if (!isPublicRoute && !isRootPath && !isAuthenticated) {
      console.log(`Middleware: Redirecting unauthenticated user from ${pathname} to /login`);
      const redirectUrl = new URL('/login', request.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // If the user is already authenticated and tries to access login page, redirect to home
    if (pathname === '/login' && isAuthenticated) {
      console.log(`Middleware: Redirecting authenticated user from /login to /`);
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // For all other cases, continue with the request
    return response;
  } catch (e) {
    console.error('Middleware error:', e);
    return response;
  }
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    // Match all routes except static files, api routes, and auth callback
    '/((?!_next/static|_next/image|favicon.ico|images).*)',
  ],
}; 