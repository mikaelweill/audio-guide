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
  verifyOtp: (email: string, token: string) => Promise<void>;
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
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          throw error;
        }
        
        if (session) {
          console.log('Found existing session:', session.user.email);
          setSession(session);
          setUser(session.user);
        } else {
          console.log('No session found');
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
      }
    };
    
    initializeAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setUser(session?.user || null);
        setSession(session);
        
        // Clear any previous errors when auth state changes
        setError(null);
        
        if (event === 'SIGNED_IN') {
          console.log('User signed in, refreshing page');
          // Don't push to home if we're already there
          if (window.location.pathname !== '/') {
            router.push('/');
          } else {
            router.refresh();
          }
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, redirecting to login');
          // Only refresh if we're not already redirecting
          if (window.location.pathname !== '/login') {
            router.push('/login');
          } else {
            router.refresh();
          }
        }
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);
  
  // Send OTP for email verification
  const sendOtp = async (email: string, isSignUp: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // For both sign in and sign up, use signInWithOtp
      // This works for both new and existing users
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Allow creating users automatically
          emailRedirectTo: undefined // Disable magic links
        }
      });
      
      if (error) throw error;
      
      console.log('OTP sent successfully for:', email);
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      setError(error.message || 'Failed to send verification code.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verify OTP token
  const verifyOtp = async (email: string, token: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // For OTP via email, we need to use 'email' type
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      
      if (error) throw error;
      
      router.push('/');
    } catch (error: any) {
      console.error('Error verifying code:', error);
      setError(error.message || 'Invalid or expired verification code.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign out
  const signOut = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
    } catch (error: any) {
      console.error('Error signing out:', error);
      setError(error.message || 'Failed to sign out.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Derived authentication state
  const isAuthenticated = !!user;
  
  const value = {
    user,
    session,
    isLoading,
    isAuthenticated,
    sendOtp,
    verifyOtp,
    signOut,
    error,
  };
  
  // Debug auth state
  useEffect(() => {
    console.log('Auth state updated:', {
      user: user?.email,
      isAuthenticated,
      isLoading
    });
  }, [user, isAuthenticated, isLoading]);
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
} 