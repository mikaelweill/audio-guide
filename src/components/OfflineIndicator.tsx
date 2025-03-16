'use client';

import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);
    
    // Add event listeners for online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Clean up listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  if (!isOffline) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 p-4 rounded-lg shadow-lg border border-orange-500/30 z-50 animate-fade-in">
      <h3 className="text-orange-400 font-medium mb-2 flex items-center">
        <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></span>
        You're offline
      </h3>
      <p className="text-white/80 text-sm mb-2">
        Some features may be unavailable until you reconnect.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="w-full py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded text-sm"
      >
        Refresh
      </button>
    </div>
  );
} 