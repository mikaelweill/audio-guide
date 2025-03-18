'use client';

import { useState, useEffect } from 'react';
import { getAllDownloadedTours } from '@/services/offlineTourService';
import Link from 'next/link';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [downloadedTours, setDownloadedTours] = useState<{ id: string; tour: any }[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);
    
    // Add event listeners for online/offline status
    const handleOnline = () => {
      setIsOffline(false);
      // Reset dismissed count when coming back online
      setDismissedCount(0);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      // Check downloaded tours when going offline
      checkDownloadedTours();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check for downloaded tours
    checkDownloadedTours();
    
    // Clean up listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Function to check downloaded tours
  const checkDownloadedTours = async () => {
    try {
      const tours = await getAllDownloadedTours();
      setDownloadedTours(tours);
    } catch (error) {
      console.error('Error fetching downloaded tours:', error);
    }
  };

  // Dismiss the notification and increment the counter
  const dismissNotification = () => {
    // If they've dismissed it more than twice, keep it minimal
    if (dismissedCount >= 2) {
      setIsExpanded(false);
    } else {
      setDismissedCount(prevCount => prevCount + 1);
    }
  };
  
  // If online, don't show anything
  if (!isOffline) return null;
  
  // If dismissed more than twice, show a minimal indicator
  if (dismissedCount >= 2 && !isExpanded) {
    return (
      <button 
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 bg-slate-800 p-2 rounded-full shadow-lg border border-orange-500/30 z-50 animate-fade-in hover:bg-slate-700"
        title="You're offline - Click for more info"
      >
        <span className="flex h-3 w-3">
          <span className="animate-ping absolute h-3 w-3 rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative rounded-full h-3 w-3 bg-orange-500"></span>
        </span>
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-orange-500/30 z-50 animate-fade-in max-w-xs">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-orange-400 font-medium flex items-center">
          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></span>
          You're offline
        </h3>
        <button 
          onClick={dismissNotification}
          className="text-gray-400 hover:text-gray-300 ml-2"
          aria-label="Dismiss notification"
        >
          {isExpanded ? "✕" : "−"}
        </button>
      </div>
      
      {downloadedTours.length > 0 ? (
        <>
          <p className="text-white/80 text-sm mb-2">
            You have {downloadedTours.length} tour{downloadedTours.length !== 1 ? 's' : ''} available offline:
          </p>
          {isExpanded && (
            <ul className="text-sm text-white/70 mb-3 space-y-1 max-h-32 overflow-y-auto">
              {downloadedTours.map(item => (
                <li key={item.id} className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                  <Link href={`/tour/${item.id}`} className="text-green-300 hover:text-green-200 truncate">
                    {item.tour.name || 'Unnamed Tour'}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-white/80 text-sm mb-2">
          No tours are available offline. Connect to download tours.
        </p>
      )}
      
      <div className="flex space-x-2">
        <button 
          onClick={() => window.location.reload()} 
          className="flex-1 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded text-sm"
        >
          Refresh
        </button>
        {downloadedTours.length > 0 && (
          <Link 
            href="/"
            className="py-1.5 px-3 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded text-sm flex items-center"
          >
            <span>View Tours</span>
          </Link>
        )}
      </div>
    </div>
  );
} 