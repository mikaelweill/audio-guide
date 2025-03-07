'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

// Initialize the singleton Supabase client
const supabase = createClient();

// For debugging
const AUTH_DEBUG = true;
const logAuth = (...args: any[]) => {
  if (AUTH_DEBUG) {
    console.log(`🔐 AUTH [${new Date().toISOString().split('T')[1].split('.')[0]}]:`, ...args);
  }
};

// Add a utility to check if objects are equivalent (for user comparison)
function isUserEquivalent(user1: User | null, user2: User | null): boolean {
  if (!user1 && !user2) return true;
  if (!user1 || !user2) return false;
  return user1.id === user2.id;
}

// Increase throttling time to prevent excessive re-renders and auth state updates
const AUTH_THROTTLE_MS = 2000; // Minimum 2 seconds between auth updates

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
  // Auth listener cleanup function reference
  const authListenerCleanup = useRef<(() => void) | null>(null);
  // Last auth event timestamp
  const lastAuthEventTime = useRef<number>(0);
  
  // Clear all cookies for sign out - more aggressive approach
  const clearAllCookies = () => {
    if (typeof document === 'undefined') return;
    
    logAuth('Force-clearing ALL auth cookies');
    const cookies = document.cookie.split(';');
    
    cookies.forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name) {
        // Clear with multiple path/domain combinations to ensure complete removal
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
        logAuth(`Deleted cookie: ${name}`);
      }
    });
  };
  
  // Check for session on initial load - only happens once
  useEffect(() => {
    // Only run once
    if (isInitialized.current) return;
    
    const initializeAuth = async () => {
      const startTime = Date.now();
      logAuth(`AUTH INIT START (${startTime})`);
      setIsLoading(true);
      // Mark as initialized to prevent loops
      isInitialized.current = true;
      
      try {
        // Get current session
        logAuth('Initializing auth state');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logAuth('Error checking session:', error.message);
          setError(error.message);
          setIsLoading(false);
          return;
        }
        
        if (session) {
          logAuth(`Session found for ${session.user.email} (expires: ${new Date(session.expires_at! * 1000).toISOString()})`);
          logAuth(`User ID: ${session.user.id}`);
          
          // Check token validity
          const nowInSeconds = Math.floor(Date.now() / 1000);
          const expiresAt = session.expires_at || 0;
          const timeUntilExpiry = expiresAt - nowInSeconds;
          
          logAuth(`Token expires in: ${timeUntilExpiry} seconds (${Math.floor(timeUntilExpiry / 60)} minutes)`);
          
          setUser(session.user);
          setSession(session);
          
          // Debug cookie state after session is found
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';');
            logAuth(`Cookies (${cookies.length}):`, cookies.map(c => c.trim().split('=')[0]).join(', ') || 'none');
          }
        } else {
          logAuth('No session found');
          setUser(null);
          setSession(null);
        }
        
        // Clean up any existing listener before setting up a new one
        if (authListenerCleanup.current) {
          logAuth('Cleaning up previous auth listener');
          authListenerCleanup.current();
          authListenerCleanup.current = null;
        }
        
        // Subscribe to auth changes with improved throttling
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            logAuth(`AUTH EVENT: ${event}`, newSession?.user?.email || 'no user');
            
            // Apply improved throttling for all events
            const now = Date.now();
            const timeSinceLastEvent = now - lastAuthEventTime.current;
            
            if (timeSinceLastEvent < AUTH_THROTTLE_MS) {
              logAuth(`Throttling auth event - too soon after previous (${timeSinceLastEvent}ms < ${AUTH_THROTTLE_MS}ms)`);
              return;
            }
            
            // Update last event time
            lastAuthEventTime.current = now;
            
            // Prevent reentrant auth processing that can cause loops
            if (processingAuthChange.current) {
              logAuth('Already processing an auth change, skipping to prevent loops');
              return;
            }
            
            // Skip redundant TOKEN_REFRESHED events that don't change the user
            if (event === 'TOKEN_REFRESHED' && isUserEquivalent(user, newSession?.user || null)) {
              logAuth('Skipping redundant token refresh - user unchanged');
              return;
            }
            
            processingAuthChange.current = true;
            
            try {
              if (event === 'SIGNED_IN' && newSession) {
                logAuth(`Sign in for ${newSession.user.email}`);
                
                // Only update state if user has changed
                if (!isUserEquivalent(user, newSession.user)) {
                  setUser(newSession.user);
                  setSession(newSession);
                  logAuth('Updated user state after sign in');
                } else {
                  logAuth('User unchanged, skipping state update');
                }
              } else if (event === 'SIGNED_OUT') {
                logAuth('User signed out');
                setUser(null);
                setSession(null);
              } else if (event === 'TOKEN_REFRESHED' && newSession) {
                logAuth(`Token refreshed for ${newSession.user.email}`);
                
                // Only update if session has actually changed
                const currentExpiry = session?.expires_at || 0;
                const newExpiry = newSession.expires_at || 0;
                
                if (currentExpiry !== newExpiry) {
                  logAuth(`Updating session with new expiry: ${new Date(newExpiry * 1000).toISOString()}`);
                  setSession(newSession);
                } else {
                  logAuth('Token refresh did not change expiry, skipping update');
                }
              }
            } finally {
              processingAuthChange.current = false;
            }
          }
        );
        
        // Store the cleanup function
        authListenerCleanup.current = () => {
          authListener.subscription.unsubscribe();
        };
        
        // Return cleanup function
        return authListenerCleanup.current;
      } catch (err) {
        console.error('Error in auth initialization:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
      } finally {
        setIsLoading(false);
        const duration = Date.now() - startTime;
        logAuth(`Auth initialization completed in ${duration}ms`);
      }
    };
    
    initializeAuth();
    
    // Cleanup function
    return () => {
      if (authListenerCleanup.current) {
        logAuth('Cleaning up auth listener on unmount');
        authListenerCleanup.current();
      }
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
      logAuth('Verifying OTP to sign in');
      
      // Verify the OTP
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      
      if (error) {
        logAuth('OTP verification failed:', error.message);
        throw error;
      }
      
      logAuth('Successfully verified OTP, user signed in');
      setUser(data.user);
      setSession(data.session);
      
      // Set a flag to help middleware know we just logged in
      // This prevents potential redirect loops
      if (typeof window !== 'undefined') {
        logAuth('Setting justLoggedIn flag');
        window.sessionStorage.setItem('justLoggedIn', 'true');
        window.sessionStorage.setItem('loginTimestamp', Date.now().toString());
        
        // Give cookies a moment to be fully set
        logAuth('Preparing for hard reload to ensure clean state');
        setTimeout(() => {
          // Force a hard reload to ensure clean state and all cookies are properly set
          logAuth('Performing hard reload to home page');
          window.location.href = '/';
        }, 500);
      }
      
      return data;
    } catch (error: any) {
      console.error('Error verifying OTP:', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign out with improved cookie clearing and state management
  const signOut = async () => {
    try {
      logAuth('Sign out process starting');
      setIsLoading(true);
      
      // Step 1: Clear React state immediately
      setUser(null);
      setSession(null);
      
      // Step 2: Aggressively clear all cookies
      if (typeof document !== 'undefined') {
        clearAllCookies();
      }
      
      // Step 3: Call Supabase signOut (but don't wait for it)
      logAuth('Calling Supabase signOut API');
      try {
        const signOutPromise = supabase.auth.signOut();
        
        // Don't await - we want to proceed with cleanup regardless of API response
        signOutPromise.catch(e => {
          logAuth('Error in Supabase signOut (continuing with cleanup):', e);
        });
      } catch (e) {
        logAuth('Exception in Supabase signOut - continuing with force logout', e);
      }
      
      // Step 4: Clear all storage
      if (typeof window !== 'undefined') {
        // Clear local and session storage
        logAuth('Clearing localStorage and sessionStorage');
        try {
          // Specifically target any remaining auth items first
          const authItems = [
            'supabase.auth.token',
            'sb-access-token',
            'sb-refresh-token'
          ];
          
          authItems.forEach(item => {
            localStorage.removeItem(item);
            sessionStorage.removeItem(item);
          });
          
          // Then clear everything else except our signout flag
          // Store the flag first as we'll clear storage
          sessionStorage.setItem('manualSignOut', 'true');
          const signOutTime = Date.now().toString();
          sessionStorage.setItem('signOutTime', signOutTime);
          
          // Clear storage but preserve our flags
          const manualSignOut = sessionStorage.getItem('manualSignOut');
          const signOutTimeValue = sessionStorage.getItem('signOutTime');
          
          localStorage.clear();
          sessionStorage.clear();
          
          // Restore our flags
          sessionStorage.setItem('manualSignOut', manualSignOut || 'true');
          sessionStorage.setItem('signOutTime', signOutTimeValue || signOutTime);
        } catch (e) {
          logAuth('Error clearing storage', e);
        }
      }
      
      logAuth('Sign out operations completed');
      
      // Step 5: Force hard reload to login page
      logAuth('Forcing hard reload to login page');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even on error, still force reload to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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