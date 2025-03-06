import { createBrowserClient } from '@supabase/ssr'

// Environment variables will need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create a single supabase client for browser client-side
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// For debugging cookie issues
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase cookie config:', {
    domain: window.location.hostname,
    secure: window.location.protocol === 'https:',
    sameSite: 'lax'
  });
}

// Log auth state changes for debugging
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Supabase auth event:', event, session?.user?.email);
    
    // If we get a SIGNED_IN event, check if cookies were set
    if (event === 'SIGNED_IN') {
      setTimeout(() => {
        // Log all cookies (just names for security)
        const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
        console.log('🍪 Cookies after SIGNED_IN:', cookies.length ? cookies.join(', ') : 'none');
      }, 500);
    }
  });
}

// For server components
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