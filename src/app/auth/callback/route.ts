import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // Log for debugging
  console.log('🔄 Auth callback route accessed, code present:', !!code)
  
  if (code) {
    const supabase = createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Error exchanging code for session:', error.message)
      
      // Return to login with error
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      )
    }
    
    console.log('✅ Successfully exchanged code for session')
  }
  
  // Always redirect to root after successful sign in or if no code
  return NextResponse.redirect(new URL('/', request.url))
} 