'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Define the context type
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sendOtp: (email: string, isSignUp?: boolean) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<{ user: User | null; session: Session | null } | void>;
  signOut: () => Promise<void>;
  error: string | null;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  sendOtp: async () => {},
  verifyOtp: async () => {},
  signOut: async () => {},
  error: null,
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component to wrap the app
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  
  // Check for session on initial load
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        // Get current session
        console.log('Fetching initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          throw error;
        }
        
        if (session) {
          const logInfo = {
            user: session.user.email,
            id: session.user.id,
          };
          
          // Add expiry information if available
          if (session.expires_at) {
            const expiryDate = new Date(session.expires_at * 1000);
            const remainingMinutes = Math.floor((session.expires_at * 1000 - Date.now()) / 1000 / 60);
            
            Object.assign(logInfo, {
              expires_at: expiryDate.toLocaleString(),
              remaining: remainingMinutes + ' minutes'
            });
          }
          
          console.log('Found existing session:', logInfo);
          setSession(session);
          setUser(session.user);
        } else {
          console.log('No session found, user is not authenticated');
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error loading auth:', error);
        setError('Failed to load authentication.');
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
        console.log('Auth initialization complete, loading set to false');
      }
    };
    
    initializeAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setUser(session?.user || null);
        setSession(session);
        setIsLoading(false);
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Send OTP for email verification
  const sendOtp = async (email: string, isSignUp = true) => {
    try {
      setIsLoading(true);
      
      // Use OTP (magic link fallback)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: isSignUp,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        throw error;
      }
      
      return;
    } catch (error: any) {
      console.error('Error sending OTP:', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verify OTP
  const verifyOtp = async (email: string, token: string) => {
    try {
      setIsLoading(true);
      
      // Verify the OTP
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      
      if (error) {
        throw error;
      }
      
      setUser(data.user);
      setSession(data.session);
      
      return data;
    } catch (error: any) {
      console.error('Error verifying OTP:', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      setUser(null);
      setSession(null);
      
      // Redirect to home after signout
      router.push('/');
    } catch (error: any) {
      console.error('Error signing out:', error.message);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Compute isAuthenticated
  const isAuthenticated = !!user && !!session;
  
  // Provider value
  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated,
    sendOtp,
    verifyOtp,
    signOut,
    error,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
} 