'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';

export default function DebugPanel() {
  const [expanded, setExpanded] = useState(false);
  const [info, setInfo] = useState<Record<string, any>>({});
  const { user, isLoading } = useAuth();
  const renderCountRef = useRef(0);
  
  useEffect(() => {
    renderCountRef.current += 1;
  });
  
  const refreshState = async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    
    // Get cookies
    const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
    
    // Get local storage items
    const localStorageItems = Object.keys(localStorage)
      .filter(key => key.includes('supabase') || key.includes('sb-'))
      .reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {} as Record<string, any>);
      
    // Get session storage items
    const sessionStorageItems = Object.keys(sessionStorage)
      .filter(key => key.includes('supabase') || key.includes('sb-'))
      .reduce((acc, key) => {
        acc[key] = sessionStorage.getItem(key);
        return acc;
      }, {} as Record<string, any>);
    
    setInfo({
      user: user,
      authLoading: isLoading,
      session: data.session,
      renderCount: renderCountRef.current,
      url: window.location.href,
      cookies,
      localStorageItems,
      sessionStorageItems,
      time: new Date().toISOString()
    });
  };
  
  if (!expanded) {
    return (
      <button
        onClick={() => {
          setExpanded(true);
          refreshState();
        }}
        className="fixed bottom-4 left-4 bg-purple-600 text-white p-2 rounded-full z-50 shadow-lg text-xs"
        title="Debug Info"
      >
        🐞
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 left-4 w-80 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-50 text-xs overflow-auto max-h-[80vh]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Info</h3>
        <div className="flex gap-2">
          <button 
            onClick={refreshState}
            className="text-blue-600 hover:text-blue-800"
          >
            🔄
          </button>
          <button 
            onClick={() => setExpanded(false)}
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="font-semibold">Auth State:</p>
          <p>User: {user ? user.email : 'Not logged in'}</p>
          <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
          <p>Render count: {renderCountRef.current}</p>
          <p>Time: {info.time}</p>
        </div>
        
        {info.user && (
          <div>
            <p className="font-semibold">User Info:</p>
            <pre className="bg-gray-100 p-1 rounded text-[10px] overflow-auto max-h-20">
              {JSON.stringify(info.user, null, 2)}
            </pre>
          </div>
        )}
        
        {info.session && (
          <div>
            <p className="font-semibold">Session:</p>
            <pre className="bg-gray-100 p-1 rounded text-[10px] overflow-auto max-h-20">
              {JSON.stringify({
                expires_at: info.session.expires_at,
                access_token: info.session.access_token?.substring(0, 15) + '...',
                refresh_token: info.session.refresh_token?.substring(0, 15) + '...',
              }, null, 2)}
            </pre>
          </div>
        )}
        
        <div>
          <p className="font-semibold">Cookies ({info.cookies?.length || 0}):</p>
          <ul className="list-disc pl-4 max-h-20 overflow-auto">
            {info.cookies?.map((cookie: string, i: number) => (
              <li key={i}>{cookie}</li>
            ))}
          </ul>
        </div>
        
        <div>
          <p className="font-semibold">Local Storage:</p>
          <pre className="bg-gray-100 p-1 rounded text-[10px] overflow-auto max-h-20">
            {JSON.stringify(info.localStorageItems, null, 2)}
          </pre>
        </div>
        
        <div>
          <p className="font-semibold">Session Storage:</p>
          <pre className="bg-gray-100 p-1 rounded text-[10px] overflow-auto max-h-20">
            {JSON.stringify(info.sessionStorageItems, null, 2)}
          </pre>
        </div>
        
        <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => {
              const supabase = createClient();
              supabase.auth.signOut().then(() => {
                refreshState();
              });
            }}
            className="px-2 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs"
          >
            Force Signout
          </button>
          
          <button
            onClick={() => {
              document.cookie.split(";").forEach((c) => {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
              });
              refreshState();
            }}
            className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-xs"
          >
            Clear Cookies
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
} 