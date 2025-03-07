'use client';

import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

/**
 * AuthStatus component displays a floating status indicator
 * for auth state with force sign out option for debugging
 */
export default function AuthStatus() {
  const { user, signOut, isLoading } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  
  // If no user or still loading, don't show anything
  if (!user || isLoading) {
    return null;
  }
  
  // Get all cookies for debugging
  const getCookies = () => {
    if (typeof document === 'undefined') return [];
    return document.cookie.split(';').map(c => c.trim());
  };
  
  // Get local/session storage auth items
  const getStorageItems = () => {
    if (typeof window === 'undefined') return [];
    
    const localStorageItems = Object.keys(localStorage)
      .filter(key => key.includes('supabase') || key.includes('sb-') || key.includes('auth'))
      .map(key => `localStorage: ${key}`);
      
    const sessionStorageItems = Object.keys(sessionStorage)
      .filter(key => key.includes('supabase') || key.includes('sb-') || key.includes('auth'))
      .map(key => `sessionStorage: ${key}`);
      
    return [...localStorageItems, ...sessionStorageItems];
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed state - just show button */}
      {!expanded ? (
        <button 
          onClick={() => setExpanded(true)}
          className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center w-10 h-10 text-xl"
          title="Auth Status"
        >
          🔐
        </button>
      ) : (
        // Expanded state - show auth info and actions
        <div className="bg-white rounded-lg shadow-xl p-4 w-80 border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">Auth Status</h3>
            <button 
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4 pb-3 border-b border-gray-100">
            <p className="text-sm text-gray-600 mb-1">
              <strong>User:</strong> {user.email}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>ID:</strong> {user.id.substring(0, 8)}...
            </p>
            <p className="text-xs text-gray-400">
              Session active
            </p>
          </div>
          
          <div className="space-y-2">
            {/* Debug section */}
            <button
              onClick={() => setShowCookies(!showCookies)}
              className="w-full text-left text-xs text-blue-600 hover:text-blue-800"
            >
              {showCookies ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
            
            {showCookies && (
              <div className="text-xs mt-2 bg-gray-50 p-2 rounded max-h-40 overflow-y-auto">
                <p className="font-semibold mb-1">Cookies:</p>
                <ul className="list-disc pl-4 mb-2">
                  {getCookies().map((cookie, i) => (
                    <li key={i} className="truncate">{cookie}</li>
                  ))}
                </ul>
                
                <p className="font-semibold mb-1">Storage:</p>
                <ul className="list-disc pl-4">
                  {getStorageItems().map((item, i) => (
                    <li key={i} className="truncate">{item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Actions */}
            <div className="pt-2 flex flex-col space-y-2">
              <button
                onClick={() => signOut()}
                className="w-full py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
              >
                Force Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 