import { createBrowserClient } from '@supabase/ssr'

// Environment variables will need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Determine if we're in a localhost environment
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Define what cookie name to use for auth
const AUTH_COOKIE_NAME = 'sb-auth-token';

// Create a single supabase client for browser client-side with minimal options
export const supabase = createBrowserClient(
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
      name: AUTH_COOKIE_NAME,
      path: '/',
      sameSite: 'lax',
      secure: !isLocalhost
    }
  }
)

// For debugging cookie issues - but only log once to prevent loops
let hasLoggedCookieInfo = false;
if (typeof window !== 'undefined' && !hasLoggedCookieInfo) {
  hasLoggedCookieInfo = true;
  console.log('🔧 Supabase client initialized with cookie config:', {
    domain: window.location.hostname,
    secure: !isLocalhost,
    sameSite: 'lax',
    path: '/'
  });
  
  // Log first auth state change only
  let firstAuthEventLogged = false;
  supabase.auth.onAuthStateChange((event, session) => {
    if (!firstAuthEventLogged) {
      console.log('⚡ Initial Supabase auth event:', event, session?.user?.email || 'no user');
      firstAuthEventLogged = true;
      
      // Only log cookies once after sign in
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => {
          const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
          console.log(`🍪 Initial cookies after ${event}:`, cookies.length ? cookies.join(', ') : 'none');
        }, 500);
      }
    }
  });
}

// For server components - use minimal version
export const createServerSupabaseClient = async () => {
  const { createServerComponentClient } = await import('@supabase/auth-helpers-nextjs');
  const { cookies } = await import('next/headers');
  return createServerComponentClient({ cookies });
};

// Helper function to get user from server component
export const getUser = async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  
  return user;
};

// Utility function to get user session
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data.session;
};

// Get user profile data
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  
  return data;
}; 