import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Create a response with the request headers
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Log the current cookies
  console.log('🔎 Middleware updateSession: Checking cookies');
  const cookieNames = request.cookies.getAll().map(cookie => cookie.name);
  console.log('🍪 Current cookies:', cookieNames.join(', ') || 'none');

  // Create a Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name);
          console.log(`🍪 Middleware cookie get: ${name} = ${cookie ? 'found' : 'not found'}`);
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          // Add debugging
          console.log(`🍪 Setting cookie in updateSession: ${name}`);
          
          // Use more permissive settings for local dev environment
          const isLocalhost = request.headers.get('host')?.includes('localhost') || false;
          
          // Ensure path is set to root to make cookies available to all routes
          const cookieOptions = {
            ...options,
            secure: isLocalhost ? false : options.secure,
            sameSite: isLocalhost ? 'lax' : options.sameSite,
            path: '/',
            httpOnly: false, // Allow JavaScript access for client debugging
          };
          
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          });
        },
        remove(name: string, options: any) {
          console.log(`🍪 Removing cookie in updateSession: ${name}`);
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
            path: '/',
          });
        },
      },
    }
  );

  // Check and refresh session if needed
  const { data } = await supabase.auth.getSession();
  console.log(`🔑 updateSession found session:`, data.session ? 'yes' : 'no');
  
  // If we have a session, ensure all response cookies are properly set
  if (data.session) {
    const allResponseCookies = response.cookies.getAll().map(c => c.name);
    console.log('🍪 Response cookies after update:', allResponseCookies.join(', ') || 'none');
  }

  return response;
} 