'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function AuthStatusBar() {
  const { user, signOut, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="bg-gray-100 py-2 px-4 text-center text-sm text-gray-600">
        Checking authentication...
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="bg-blue-50 py-2 px-4 text-center text-sm text-blue-700">
        <Link href="/login" className="font-medium hover:underline">
          Sign in
        </Link>
        {' '}to create and save personalized audio tours
      </div>
    );
  }
  
  return (
    <div className="bg-gray-100 py-2 px-4 flex justify-between items-center text-sm">
      <span className="text-gray-700">
        Signed in as: <span className="font-medium">{user.email}</span>
      </span>
      <button
        onClick={() => signOut()}
        className="text-blue-600 hover:underline focus:outline-none"
      >
        Sign Out
      </button>
    </div>
  );
} 