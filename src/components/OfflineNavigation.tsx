'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAllDownloadedTours, checkIfTourIsDownloaded } from '@/services/offlineTourService';

export default function OfflineNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);
  const [processingNavigation, setProcessingNavigation] = useState(false);
  
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
  
  // Handle navigation when offline
  useEffect(() => {
    if (!isOffline || processingNavigation) return;
    
    const validateOfflineAccess = async () => {
      try {
        setProcessingNavigation(true);
        
        // Always allow navigation to home page
        if (pathname === '/') {
          setProcessingNavigation(false);
          return;
        }
        
        // Check if current path is for a tour view
        const tourIdMatch = pathname.match(/\/tour\/([^\/]+)/);
        if (tourIdMatch) {
          const tourId = tourIdMatch[1];
          
          // Check if this tour is downloaded
          const isDownloaded = await checkIfTourIsDownloaded(tourId);
          
          if (!isDownloaded) {
            console.log(`[Offline] Tour ${tourId} is not downloaded. Redirecting to home.`);
            router.push('/');
            return;
          }
        } else if (pathname !== '/offline' && !pathname.startsWith('/settings')) {
          // For non-tour pages that aren't exempt, redirect to home when offline
          console.log(`[Offline] Page ${pathname} not available offline. Redirecting to home.`);
          router.push('/');
          return;
        }
      } catch (error) {
        console.error('Error validating offline access:', error);
      } finally {
        setProcessingNavigation(false);
      }
    };
    
    validateOfflineAccess();
  }, [isOffline, pathname, router, processingNavigation]);
  
  // This is an invisible component that just manages navigation
  return null;
} 