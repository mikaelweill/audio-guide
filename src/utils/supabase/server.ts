import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import type { CookieOptions } from '@supabase/ssr'

// For use in app/ directory (Server Components)
export async function createClient<T = Database>() {
  // Dynamically import cookies to avoid errors in Pages Router
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  
  return createServerClient<T>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name) {
          try {
            return cookieStore.get(name)?.value
          } catch (error) {
            console.error('Cookie get error:', error)
            return undefined
          }
        },
        async set(name, value, options) {
          try {
            cookieStore.set(name, value, options)
          } catch (error) {
            console.error('Cookie set error:', error)
          }
        },
        async remove(name, options) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
            console.error('Cookie remove error:', error)
          }
        }
      }
    }
  )
}

// For use in pages/ directory with getServerSideProps
export function createClientFromCookies<T = Database>(cookieString: string) {
  return createServerClient<T>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          const cookies = parseCookieString(cookieString)
          return cookies[name]
        },
        set() {
          // No-op for read-only
        },
        remove() {
          // No-op for read-only
        }
      }
    }
  )
}

// Helper to parse cookie string
function parseCookieString(cookieString: string): Record<string, string> {
  if (!cookieString) return {}
  
  return cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    if (key && value) acc[key] = decodeURIComponent(value)
    return acc
  }, {} as Record<string, string>)
} 