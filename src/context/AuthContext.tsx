'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
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
  // Add a ref to track initialization and prevent loops
  const isInitialized = useRef(false);
  // Add a ref to track auth events 
  const processingAuthChange = useRef(false);
  
  // Check for session on initial load
  useEffect(() => {
    // Only run once
    if (isInitialized.current) return;
    
    const initializeAuth = async () => {
      setIsLoading(true);
      // Mark as initialized to prevent loops
      isInitialized.current = true;
      
      try {
        // Get current session
        console.log('AuthContext: Initializing auth state');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthContext: Error checking session:', error.message);
          setError(error.message);
          setIsLoading(false);
          return;
        }
        
        if (session) {
          console.log('AuthContext: Session found:', session.user.email);
          setUser(session.user);
          setSession(session);
          
          // Avoid the redundant session verification that might trigger multiple auth events
          console.log('AuthContext: Session verification not needed - using existing session');
          
          // Debug cookie state after session is found
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
            console.log('🍪 AuthContext cookies:', cookies.join(', ') || 'none');
          }
        } else {
          console.log('AuthContext: No session found');
          setUser(null);
          setSession(null);
        }
        
        // Subscribe to auth changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log(`Auth state change: ${event}`, newSession?.user?.email);
            
            // Prevent reentrant auth processing that can cause loops
            if (processingAuthChange.current) {
              console.log('Already processing an auth change, skipping to prevent loops');
              return;
            }
            
            processingAuthChange.current = true;
            
            try {
              if (event === 'SIGNED_IN' && newSession) {
                setUser(newSession.user);
                setSession(newSession);
                
                // Debug cookie state after sign in
                if (typeof document !== 'undefined') {
                  setTimeout(() => {
                    const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
                    console.log('🍪 Cookies after SIGNED_IN:', cookies.join(', ') || 'none');
                  }, 500);
                }
              } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setSession(null);
              } else if (event === 'TOKEN_REFRESHED' && newSession) {
                setUser(newSession.user);
                setSession(newSession);
              }
            } finally {
              // Clear the processing flag when done
              processingAuthChange.current = false;
            }
          }
        );
        
        // Return the unsubscribe function
        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Error in auth initialization:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
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