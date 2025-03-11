'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// Language flag icons
const LANGUAGE_FLAGS: Record<string, string> = {
  'en': '🇺🇸',
  'es': '🇪🇸',
  'fr': '🇫🇷',
  'de': '🇩🇪',
  'ja': '🇯🇵'
};

export default function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut, isLoading, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const showDebug = process.env.NODE_ENV === 'development';
  
  // Add debugging to check auth state
  useEffect(() => {
    console.log('Header auth state:', { 
      user: user?.email || null, 
      isLoading,
      isAuthenticated: !!user
    });
  }, [user, isLoading]);
  
  const isLoginPage = pathname === '/login';

  // Handle sign out
  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signOut();
      // No need to redirect, the auth context will handle it
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // For login page or loading state, show minimal header
  if (isLoginPage) {
    return (
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Audio Guide
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Audio Guide
            </Link>
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        </div>
      </header>
    );
  }

  // For logged out users, show simplified header with login link
  if (!user) {
    return (
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Audio Guide
            </Link>
            <Link 
              href="/login"
              className="transition duration-150 ease-in-out text-gray-600 hover:text-blue-500"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // For authenticated users, show full header
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Audio Guide
            </Link>
            {user && (
              <span className="ml-4 text-sm text-gray-600">
                Welcome, {user.email?.split('@')[0]}
              </span>
            )}
          </div>
          
          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          
          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {/* Language indicator */}
            <div 
              className="flex items-center text-gray-600"
              title="Current language"
            >
              <span className="text-xl mr-1">{LANGUAGE_FLAGS[language]}</span>
              <span className="text-sm font-medium">{language.toUpperCase()}</span>
            </div>
            
            <NavLink href="/" active={pathname === '/'}>
              Home
            </NavLink>
            <NavLink href="/profile" active={pathname.startsWith('/profile')}>
              Profile
            </NavLink>
            <button
              onClick={handleSignOut}
              className="transition duration-150 ease-in-out text-gray-600 hover:text-blue-500"
            >
              Sign Out
            </button>
          </nav>
        </div>
        
        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4">
            <nav className="flex flex-col space-y-4">
              {/* Language indicator for mobile */}
              <div
                className="flex items-center px-4 py-2 text-gray-600"
              >
                <span className="text-xl mr-2">{LANGUAGE_FLAGS[language]}</span>
                <span>Language: {language.toUpperCase()}</span>
              </div>
              
              <MobileNavLink href="/" active={pathname === '/'}>
                Home
              </MobileNavLink>
              <MobileNavLink href="/profile" active={pathname.startsWith('/profile')}>
                Profile
              </MobileNavLink>
              <button
                onClick={handleSignOut}
                className="block px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50 hover:text-blue-500 text-left"
              >
                Sign Out
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className={`transition duration-150 ease-in-out ${
        active 
          ? 'text-blue-600 font-medium' 
          : 'text-gray-600 hover:text-blue-500'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className={`block px-4 py-2 rounded-md ${
        active 
          ? 'bg-blue-50 text-blue-600 font-medium' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-blue-500'
      }`}
    >
      {children}
    </Link>
  );
} 