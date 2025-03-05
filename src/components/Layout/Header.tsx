'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut, isLoading } = useAuth();

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

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-xl font-bold text-blue-600">
            Audio Guide
          </Link>
          
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
          <nav className="hidden md:flex space-x-8">
            <NavLink href="/" active={pathname === '/'}>
              Home
            </NavLink>
            <NavLink href="/profile" active={pathname.startsWith('/profile')}>
              Profile
            </NavLink>
            {user ? (
              <button
                onClick={handleSignOut}
                className="transition duration-150 ease-in-out text-gray-600 hover:text-blue-500"
              >
                Sign Out
              </button>
            ) : (
              <NavLink href="/login" active={pathname.startsWith('/login')}>
                Login
              </NavLink>
            )}
          </nav>
        </div>
        
        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4">
            <nav className="flex flex-col space-y-4">
              <MobileNavLink href="/" active={pathname === '/'}>
                Home
              </MobileNavLink>
              <MobileNavLink href="/profile" active={pathname.startsWith('/profile')}>
                Profile
              </MobileNavLink>
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="block px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50 hover:text-blue-500 text-left"
                >
                  Sign Out
                </button>
              ) : (
                <MobileNavLink href="/login" active={pathname.startsWith('/login')}>
                  Login
                </MobileNavLink>
              )}
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