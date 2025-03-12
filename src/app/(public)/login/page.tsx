'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

import OTPInput from '@/components/OTPInput';
import { createClient } from '@/utils/supabase/client';

// Initialize the singleton Supabase client only when actually needed
// This avoids potential module resolution issues
const getSupabaseClient = () => {
  return createClient();
};

export default function Login() {
  const router = useRouter();
  const { sendOtp, verifyOtp, isLoading, error, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  
  // Check for existing session on mount
  useEffect(() => {
    // Check existing session
    const checkSession = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      console.log('Direct Supabase session check:', { 
        session: data?.session ? 'exists' : 'none', 
        userId: data?.session?.user.id,
        error: error?.message 
      });
    };
    
    checkSession();
  }, []);
  
  // Redirect if already authenticated, but only try a limited number of times
  useEffect(() => {
    // Check if already redirecting
    if (redirectAttempts >= 3) {
      return; // Stop trying after 3 attempts
    }
    
    console.log('Login page - Auth state:', { 
      user: user?.email, 
      isLoading, 
      redirecting, 
      redirectAttempts 
    });
    
    // Only attempt redirect if:
    // 1. User is authenticated 
    // 2. Not currently in a redirecting state
    // 3. Haven't tried too many times
    if (user && !redirecting) {
      console.log('User authenticated, forcing redirect to home');
      setRedirecting(true);
      setRedirectAttempts(prev => prev + 1);
      
      // Force hard navigation
      window.location.replace('/');
    }
  }, [user, isLoading, redirecting, redirectAttempts]);
  
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!email) {
      setLocalError('Please enter your email');
      return;
    }
    
    try {
      await sendOtp(email);
      setOtpSent(true);
    } catch (err: any) {
      // ALWAYS go to OTP screen, even if rate limited
      setOtpSent(true);
      
      // Just show appropriate error message
      if (err.message && err.message.includes('rate limit')) {
        setLocalError('Email already sent. Please check your inbox and enter the code below.');
      } else {
        setLocalError(err.message || 'There was an issue sending the code, but you can still enter it if you received one previously.');
      }
    }
  };
  
  const handleVerifyOtp = async (e: React.FormEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setLocalError(null);
    
    if (!otp) {
      setLocalError('Please enter the OTP code');
      return;
    }
    
    try {
      setRedirecting(true);
      await verifyOtp(email, otp);
      // The auth state change listener will handle redirect
    } catch (err) {
      setRedirecting(false);
      // Clear the OTP on failure so user can try again with a new code
      setOtp('');
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Failed to verify OTP');
      }
    }
  };
  
  // If redirecting for too long, show a manual link
  const showManualLink = redirectAttempts >= 3;
  
  if (isLoading || (redirecting && !showManualLink)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="w-full max-w-md p-6 bg-slate-900 rounded-lg shadow-md border border-purple-900/30">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">
            {redirecting ? 'Redirecting...' : 'Checking authentication...'}
          </h1>
          
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
          </div>
          
          {redirecting && (
            <p className="mt-4 text-center text-gray-400">
              Redirecting to home page...
            </p>
          )}
        </div>
      </div>
    );
  }
  
  if (showManualLink) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4">
        <div className="w-full max-w-md p-6 bg-slate-900 rounded-lg shadow-md border border-purple-900/30">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">
            Having trouble redirecting
          </h1>
          
          <p className="mb-6 text-center text-gray-300">
            You are signed in as {user?.email} but we're having trouble redirecting you.
          </p>
          <div className="flex justify-center">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-md hover:opacity-90 transition duration-200"
            >
              Click here to go to home page
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 bg-slate-900 rounded-lg shadow-lg border border-purple-900/30">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            {otpSent ? 'Enter Verification Code' : 'Welcome to Audio Guide'}
          </h1>
          {otpSent && (
            <p className="mt-2 text-gray-300">
              We've sent a code to {email}
            </p>
          )}
        </div>
        
        {(error || localError) && (
          <div className="mb-6 p-4 bg-red-900/30 text-red-300 rounded-md border border-red-800">
            {error || localError}
          </div>
        )}
        
        {otpSent ? (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-300 mb-1">
                Verification Code
              </label>
              <div className="my-4">
                <OTPInput 
                  value={otp}
                  onChange={setOtp}
                  length={6}
                  onComplete={() => {
                    // Auto-submit the form when 6 digits are entered
                    if (otp.length === 6) {
                      // Small delay to allow UI to update
                      setTimeout(() => {
                        handleVerifyOtp(new Event('submit') as any);
                      }, 300);
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  Enter the 6-digit code sent to your email
                </div>
                <button 
                  type="button" 
                  onClick={() => setOtp('')}
                  className="text-sm text-pink-400 hover:text-pink-300"
                >
                  Clear
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-pink-600 text-white py-3 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 font-medium transition duration-200"
              disabled={isLoading && redirecting}
            >
              {isLoading && redirecting ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <div className="flex flex-col space-y-2">
              <button
                type="button"
                onClick={handleSendOtp}
                className="w-full text-pink-400 py-2 px-4 rounded-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 text-sm transition duration-200"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  setLocalError(null);
                }}
                className="w-full text-gray-400 py-2 px-4 rounded-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 text-sm transition duration-200"
              >
                Change email
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent placeholder-gray-500"
                placeholder="you@example.com"
                required
              />
              <p className="mt-2 text-sm text-gray-400">
                We'll send you a verification code to sign in or create an account.
              </p>
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-pink-600 text-white py-3 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 font-medium transition duration-200"
            >
              Send OTP
            </button>
          </form>
        )}
        
        {!otpSent && (
          <div className="mt-8 border-t border-slate-800 pt-6">
            <p className="text-sm text-gray-400 text-center mb-4">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        )}
      </div>
    </div>
  );
}