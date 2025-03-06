import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  // Create a Supabase client for server-side operations
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name) {
          try {
            // Properly await cookies() in Next.js 15
            const cookieStore = await cookies()
            return cookieStore.get(name)?.value
          } catch (error) {
            console.error('Cookie get error:', error)
            return undefined
          }
        },
        async set(name, value, options) {
          try {
            // Properly await cookies() in Next.js 15
            const cookieStore = await cookies()
            cookieStore.set(name, value, options)
          } catch (error) {
            console.error('Cookie set error:', error)
          }
        },
        async remove(name, options) {
          try {
            // Properly await cookies() in Next.js 15
            const cookieStore = await cookies()
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
            console.error('Cookie remove error:', error)
          }
        }
      }
    }
  )
} 