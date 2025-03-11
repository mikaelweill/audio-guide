'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Protected Layout - Ensures authentication for all child routes
 * All pages within the (protected) route group will be protected by this layout
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('ProtectedLayout: No user found, redirecting to login');
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
        <div className="w-16 h-16 border-4 border-t-indigo-500 border-r-transparent border-b-indigo-300 border-l-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-300">Loading your experience...</p>
      </div>
    );
  }

  // Only render children if authenticated
  return user ? <>{children}</> : null;
} 