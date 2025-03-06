import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Log middleware execution
  console.log('🔍 MIDDLEWARE EXECUTING for path:', request.nextUrl.pathname);
  
  // Log cookie names (without values for security)
  const cookieNames = request.cookies.getAll().map(cookie => cookie.name);
  console.log('📦 Cookie count:', request.cookies.getAll().length);
  console.log('🍪 Cookies present:', cookieNames.join(', '));
  
  // Update the user session with new cookies
  const response = await updateSession(request)
  
  // These paths don't require authentication or special handling
  const publicPaths = ['/', '/login', '/auth/callback', '/auth/confirm']
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname)
  
  // Skip all auth checking for API routes, public paths, and static assets
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    isPublicPath ||
    request.nextUrl.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|css|js)$/)
  ) {
    console.log('📌 Skipping auth check for path:', request.nextUrl.pathname);
    return response
  }
  
  // Check for Supabase auth cookies
  const hasSbAuthCookie = request.cookies.getAll().some(cookie => 
    cookie.name.startsWith('sb-') || cookie.name.includes('auth')
  );
  
  // If there's any auth cookie, just allow the request through
  // The frontend will handle proper authentication
  if (hasSbAuthCookie) {
    console.log('🔑 Auth cookie found, allowing access');
    return response;
  }
  
  // Only if there's no auth cookie, use server-side validation
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set() {}, // No-op for read-only check
        remove() {}, // No-op for read-only check
      },
    }
  )
  
  try {
    // Get user data
    const { data: { user } } = await supabase.auth.getUser()
    console.log('👤 User in middleware:', user ? `ID: ${user.id}` : 'Not authenticated');
    
    // Only redirect unauthenticated users away from protected routes
    if (!user) {
      console.log('🔄 No user found, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    return response
  } catch (error) {
    console.error('❌ ERROR in middleware:', error);
    return response
  }
}

export const config = {
  matcher: [
    // Match all paths except static files, API routes, and assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css)$).*)',
  ],
}; 