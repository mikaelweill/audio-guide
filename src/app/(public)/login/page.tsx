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
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center">
            {redirecting ? 'Redirecting...' : 'Checking authentication...'}
          </h1>
          
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
          </div>
          
          {redirecting && (
            <p className="mt-4 text-center text-gray-600">
              Redirecting to home page...
            </p>
          )}
        </div>
      </div>
    );
  }
  
  if (showManualLink) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Having trouble redirecting
          </h1>
          
          <p className="mb-6 text-center">
            You are signed in as {user?.email} but we're having trouble redirecting you.
          </p>
          <div className="flex justify-center">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Click here to go to home page
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {otpSent ? 'Enter Verification Code' : 'Welcome to Audio Guide'}
          </h1>
          {otpSent && (
            <p className="mt-2 text-gray-600">
              We've sent a code to {email}
            </p>
          )}
        </div>
        
        {(error || localError) && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md">
            {error || localError}
          </div>
        )}
        
        {otpSent ? (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
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
                <div className="text-sm text-gray-500">
                  Enter the 6-digit code sent to your email
                </div>
                <button 
                  type="button" 
                  onClick={() => setOtp('')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
              disabled={isLoading && redirecting}
            >
              {isLoading && redirecting ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <div className="flex flex-col space-y-2">
              <button
                type="button"
                onClick={handleSendOtp}
                className="w-full text-blue-600 py-2 px-4 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
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
                className="w-full text-gray-600 py-2 px-4 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
              >
                Back to Email
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500">
                We'll send you a verification code to sign in or create an account
              </p>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              Send OTP
            </button>
          </form>
        )}
        
        {/* Add a manual link back to home if already logged in */}
        {user && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Already signed in as {user.email}.{' '}
              <Link href="/" className="text-blue-600 hover:underline">
                Return to Home
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}