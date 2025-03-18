'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAllDownloadedTours, checkIfTourIsDownloaded } from '@/services/offlineTourService';

export default function OfflineNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);
  const [processingNavigation, setProcessingNavigation] = useState(false);
  const [downloadedTourIds, setDownloadedTourIds] = useState<string[]>([]);
  
  // Track offline status
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    
    // Set initial status
    setIsOffline(!navigator.onLine);
    
    // Add event listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  // Load downloaded tour IDs
  useEffect(() => {
    const loadDownloadedTours = async () => {
      try {
        const tours = await getAllDownloadedTours();
        setDownloadedTourIds(tours.map(tour => tour.id));
        console.log('Downloaded tour IDs loaded:', tours.map(tour => tour.id));
      } catch (error) {
        console.error('Error loading downloaded tour IDs:', error);
      }
    };
    
    loadDownloadedTours();
  }, []);
  
  // Handle navigation when offline
  useEffect(() => {
    if (!isOffline || processingNavigation) return;
    
    const validateOfflineAccess = async () => {
      try {
        setProcessingNavigation(true);
        
        // Always allow navigation to these key pages
        if (pathname === '/' || pathname === '/offline' || pathname.startsWith('/settings')) {
          setProcessingNavigation(false);
          return;
        }
        
        // Check if current path is for a tour view
        const tourIdMatch = pathname.match(/\/tour\/([^\/]+)/);
        if (tourIdMatch) {
          const tourId = tourIdMatch[1];
          
          // Check if this tour is downloaded using both methods for redundancy
          const isDownloaded = await checkIfTourIsDownloaded(tourId);
          const isInDownloadedList = downloadedTourIds.includes(tourId);
          
          if (isDownloaded || isInDownloadedList) {
            console.log(`[Offline] Tour ${tourId} is downloaded. Access allowed.`);
            setProcessingNavigation(false);
            return;
          }
          
          // Emergency bypass: Check localStorage for forced offline bypass
          if (typeof window !== 'undefined') {
            const bypassOfflineCheck = localStorage.getItem('bypassOfflineCheck') === 'true';
            if (bypassOfflineCheck) {
              console.log('[Offline] EMERGENCY BYPASS ENABLED - allowing access despite tour not downloaded');
              setProcessingNavigation(false);
              return;
            }
          }
          
          console.log(`[Offline] Tour ${tourId} is not downloaded. Redirecting to home.`);
          router.push('/');
          return;
        } else {
          // For non-tour pages that aren't exempt, add a warning but allow access
          console.log(`[Offline] Page ${pathname} not explicitly supported offline, but allowing access.`);
          setProcessingNavigation(false);
          return;
        }
      } catch (error) {
        console.error('Error validating offline access:', error);
        
        // On error, enable emergency access rather than blocking
        setProcessingNavigation(false);
      } finally {
        setProcessingNavigation(false);
      }
    };
    
    validateOfflineAccess();
  }, [isOffline, pathname, router, processingNavigation, downloadedTourIds]);
  
  // Add button to force offline access bypass if blocked
  if (isOffline && processingNavigation) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <button 
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.setItem('bypassOfflineCheck', 'true');
              window.location.reload();
            }
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-full text-sm shadow-lg"
        >
          Force Offline Access
        </button>
      </div>
    );
  }
  
  // This is normally an invisible component that just manages navigation
  return null;
} 