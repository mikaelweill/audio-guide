import { createClient } from '@supabase/supabase-js';

// Environment variables will need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    // Force OTP instead of magic links
    detectSessionInUrl: false,
    // Customize auth settings
    autoRefreshToken: true,
    persistSession: true,
  }
});

// Log auth state changes for debugging
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Supabase auth event:', event, session?.user?.email);
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