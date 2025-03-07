'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Public Layout - Allows access without authentication
 * Pages like login, signup, landing page will use this layout
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirect to home if already authenticated (for login/signup pages)
  useEffect(() => {
    // Only redirect if on a true auth page like login or signup
    // Don't redirect from public pages that authenticated users can still view
    const isAuthPage = window.location.pathname === '/login' || 
                      window.location.pathname === '/signup';
                      
    if (!isLoading && user && isAuthPage) {
      console.log('PublicLayout: User already authenticated, redirecting to home');
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Always render children, but might redirect if authenticated
  return <>{children}</>;
} 