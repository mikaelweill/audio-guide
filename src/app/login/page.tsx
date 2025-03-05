'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const { sendOtp, verifyOtp, isLoading, error, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  
  // Redirect if already authenticated, but only try a limited number of times
  useEffect(() => {
    console.log('Login page - Auth state:', { 
      user: user?.email, 
      isLoading, 
      redirecting, 
      redirectAttempts 
    });
    
    if (user && !redirecting && redirectAttempts < 3) {
      console.log('User authenticated, attempting redirect to home');
      setRedirecting(true);
      setRedirectAttempts(prev => prev + 1);
      
      // Use a timeout to prevent immediate redirect
      const redirectTimer = setTimeout(() => {
        router.push('/');
      }, 500);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [user, router, isLoading, redirecting, redirectAttempts]);
  
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!email) {
      setLocalError('Please enter your email');
      return;
    }
    
    try {
      // Always pass true for isSignUp to ensure new users can be created automatically
      await sendOtp(email, true);
      setOtpSent(true);
    } catch (err) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Failed to send OTP');
      }
    }
  };
  
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the 6-digit code"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              Verify & Continue
            </button>
            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full text-blue-600 py-2 px-4 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
            >
              Back to Email
            </button>
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