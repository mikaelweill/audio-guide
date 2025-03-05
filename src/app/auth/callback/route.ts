import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/*
 * NOTE: This callback route is no longer actively used in the application.
 * 
 * We've switched to direct OTP code verification in the frontend using the verifyOtp method.
 * This file is kept for reference and backwards compatibility in case we ever
 * need to switch back to the magic link approach.
 *
 * If using the magic link approach, this route handles the redirect from the link
 * and exchanges the authorization code for a session.
 */

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code);
  }
  
  // URL to redirect to after sign in
  return NextResponse.redirect(new URL('/', request.url));
} 