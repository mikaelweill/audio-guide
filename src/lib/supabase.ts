/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from @/utils/supabase/client directly.
 */

import { createClient } from '@/utils/supabase/client';

// Re-export using the correct singleton pattern
export const supabase = createClient();

// Re-export utility functions for backward compatibility
export const getUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return data.user;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data.session;
};

// Export the createServerSupabaseClient function 
export const createServerSupabaseClient = async () => {
  const { createClient } = await import('@/utils/supabase/server');
  return createClient();
};

// Helper function to get user profile data
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