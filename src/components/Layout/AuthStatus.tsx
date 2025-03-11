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
          className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-2 rounded-full shadow-lg hover:from-indigo-700 hover:to-blue-700 flex items-center justify-center w-10 h-10 text-xl transition-all duration-300"
          title="Auth Status"
        >
          🔐
        </button>
      ) : (
        // Expanded state - show auth info and actions
        <div className="bg-slate-800 rounded-lg shadow-xl p-4 w-80 border border-slate-700 text-white">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-100">Auth Status</h3>
            <button 
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4 pb-3 border-b border-slate-700">
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 mr-2">
                {user.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm text-gray-200">
                  {user.email}
                </p>
                <p className="text-xs text-indigo-400">
                  Active Session
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              <strong>ID:</strong> {user.id.substring(0, 8)}...
            </p>
          </div>
          
          <div className="space-y-2">
            {/* Debug section */}
            <button
              onClick={() => setShowCookies(!showCookies)}
              className="w-full text-left text-xs text-indigo-400 hover:text-indigo-300 flex items-center"
            >
              <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              {showCookies ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
            
            {showCookies && (
              <div className="text-xs mt-2 bg-slate-900 p-2 rounded max-h-40 overflow-y-auto border border-slate-700">
                <p className="font-semibold mb-1 text-indigo-300">Cookies:</p>
                <ul className="list-disc pl-4 mb-2 text-gray-300">
                  {getCookies().map((cookie, i) => (
                    <li key={i} className="truncate">{cookie}</li>
                  ))}
                </ul>
                
                <p className="font-semibold mb-1 text-indigo-300">Storage:</p>
                <ul className="list-disc pl-4 text-gray-300">
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
                className="w-full py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md hover:from-red-700 hover:to-red-800 text-sm transition-colors"
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