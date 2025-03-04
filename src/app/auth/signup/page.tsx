'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic validation
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      // Will implement actual Supabase authentication here
      console.log('Signing up with', { email, password });
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to home page
      window.location.href = '/';
    } catch (err) {
      setError('Failed to sign up. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 py-12">
      <h1 className="text-2xl font-semibold mb-6 text-center">Create Account</h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-200 ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </div>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>

      <div className="mt-8 border-t pt-6">
        <p className="text-sm text-gray-500 text-center mb-4">
          Or sign up with
        </p>
        <div className="flex justify-center space-x-4">
          <button 
            className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition duration-200"
            onClick={() => alert('Google auth will be implemented')}
          >
            Google
          </button>
          <button
            className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition duration-200"
            onClick={() => alert('GitHub auth will be implemented')}
          >
            GitHub
          </button>
        </div>
      </div>
    </div>
  );
} 