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
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">
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
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">
              Audio Guide
            </Link>
            <div className="flex items-center">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mr-2"></div>
              <span className="text-sm text-gray-400">Loading...</span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // For logged out users, show simplified header with login link
  if (!user) {
    return (
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">
              Audio Guide
            </Link>
            <Link 
              href="/login"
              className="transition duration-150 ease-in-out text-gray-300 hover:text-indigo-400"
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
    <header className="bg-slate-900 border-b border-slate-800 backdrop-blur-sm bg-opacity-90 sticky top-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">
              Audio Guide
            </Link>
            {user && (
              <span className="ml-4 text-sm text-gray-300">
                Welcome, <span className="text-indigo-300">{user.email?.split('@')[0]}</span>
              </span>
            )}
          </div>
          
          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2 text-gray-300 hover:text-indigo-400 focus:outline-none" 
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
              className="flex items-center text-gray-300 bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700"
              title="Current language"
            >
              <span className="text-lg mr-1">{LANGUAGE_FLAGS[language]}</span>
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
              className="transition duration-150 ease-in-out text-gray-300 hover:text-red-400 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign Out
            </button>
          </nav>
        </div>
        
        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <nav className="flex flex-col space-y-4">
              {/* Language indicator for mobile */}
              <div
                className="flex items-center px-4 py-2 text-gray-300 bg-slate-800/60 rounded-md"
              >
                <span className="text-lg mr-2">{LANGUAGE_FLAGS[language]}</span>
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
                className="flex items-center w-full px-4 py-2 rounded-md text-gray-300 hover:bg-slate-800/60 hover:text-red-400 text-left"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
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
          ? 'text-indigo-400 font-medium' 
          : 'text-gray-300 hover:text-indigo-400'
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
          ? 'bg-indigo-900/30 text-indigo-400 font-medium border border-indigo-800/30' 
          : 'text-gray-300 hover:bg-slate-800/60 hover:text-indigo-400'
      }`}
    >
      {children}
    </Link>
  );
} 