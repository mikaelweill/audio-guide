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
            // Access cookies synchronously for now (supported in Next.js 14/15)
            // Will need to be updated to await cookies() in future versions
            const cookieStore = cookies()
            return cookieStore.get(name)?.value
          } catch (error) {
            console.error('Cookie get error:', error)
            return undefined
          }
        },
        async set(name, value, options) {
          try {
            // Access cookies synchronously for now (supported in Next.js 14/15)
            // Will need to be updated to await cookies() in future versions
            const cookieStore = cookies()
            cookieStore.set(name, value, options)
          } catch (error) {
            console.error('Cookie set error:', error)
          }
        },
        async remove(name, options) {
          try {
            // Access cookies synchronously for now (supported in Next.js 14/15)
            // Will need to be updated to await cookies() in future versions
            const cookieStore = cookies()
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
            console.error('Cookie remove error:', error)
          }
        }
      }
    }
  )
} 