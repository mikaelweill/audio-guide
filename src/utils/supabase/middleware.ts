import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Create a response with the request headers
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create a Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // Add debugging
          console.log(`🍪 Setting cookie in updateSession: ${name}`)
          
          // Use more permissive settings for local dev environment
          const isLocalhost = request.headers.get('host')?.includes('localhost') || false
          
          const cookieOptions = {
            ...options,
            secure: isLocalhost ? false : options.secure,
            sameSite: isLocalhost ? 'lax' : options.sameSite,
            path: options.path || '/',
          }
          
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
        },
        remove(name: string, options: any) {
          console.log(`🍪 Removing cookie in updateSession: ${name}`)
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          })
        },
      },
    }
  )

  // Check and refresh session if needed
  const { data } = await supabase.auth.getSession()
  console.log(`🔑 updateSession found session:`, data.session ? 'yes' : 'no')

  return response
} 