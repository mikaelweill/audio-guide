import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Use a singleton pattern to ensure only one client instance exists
let supabaseClientInstance: SupabaseClient | null = null

export function createClient() {
  // If an instance already exists, return it instead of creating a new one
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }
  
  // Determine if we're in a localhost environment
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  
  // Create a new instance with optimized settings
  supabaseClientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookieOptions: {
        // Let Supabase handle cookie naming automatically
        path: '/',
        sameSite: 'lax',
        secure: !isLocalhost
      },
      // Set global fetch options to prevent hanging requests
      global: {
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            // Add timeout to all requests to prevent UI hanging
            signal: options?.signal || AbortSignal.timeout(10000), // 10 seconds timeout
          });
        }
      }
    }
  )
  
  // For debugging - log client creation once
  if (typeof window !== 'undefined') {
    console.log('🔄 Supabase browser client initialized (singleton)')
  }
  
  return supabaseClientInstance
} 