'use client';

import { useState } from 'react';

export default function OfflineEmergencyAccess() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Only show this in offline mode
  if (!isOffline) return null;
  
  const enableEmergencyAccess = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bypassOfflineCheck', 'true');
      alert('Emergency offline access enabled. Reloading page...');
      window.location.reload();
    }
  };
  
  return (
    <div className="fixed bottom-20 right-4 z-50">
      <button 
        onClick={enableEmergencyAccess}
        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-full text-sm shadow-lg flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Emergency Access
      </button>
    </div>
  );
} 