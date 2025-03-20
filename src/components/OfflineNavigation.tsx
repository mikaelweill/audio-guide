'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  getAllDownloadedTours, 
  checkIfTourIsDownloaded, 
  verifyTourForOffline 
} from '@/services/offlineTourService';

export default function OfflineNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);
  const [processingNavigation, setProcessingNavigation] = useState(false);
  const [downloadedTourIds, setDownloadedTourIds] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
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
          
          // Enhanced validation - check not just if downloaded but if ALL resources are available
          const isFullyDownloaded = await verifyTourForOffline(tourId);
          
          // Also check the basic download status for diagnostics
          const isBasicDownloaded = await checkIfTourIsDownloaded(tourId);
          const isInDownloadedList = downloadedTourIds.includes(tourId);
          
          console.log(`[Offline] Tour ${tourId} validation:`, {
            basicDownloaded: isBasicDownloaded,
            inDownloadedList: isInDownloadedList,
            fullyDownloaded: isFullyDownloaded
          });
          
          if (isFullyDownloaded) {
            console.log(`[Offline] Tour ${tourId} is fully downloaded with all resources. Access allowed.`);
            setProcessingNavigation(false);
            return;
          }
          
          // If basic check passes but full validation fails, track the error
          if (isBasicDownloaded || isInDownloadedList) {
            console.warn(`[Offline] Tour ${tourId} exists but resources are incomplete. Access denied.`);
            setValidationErrors({
              ...validationErrors,
              [tourId]: 'Tour resources are incomplete. Please try downloading again when online.'
            });
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
          
          console.log(`[Offline] Tour ${tourId} is not properly downloaded. Redirecting to home.`);
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
  }, [isOffline, pathname, router, processingNavigation, downloadedTourIds, validationErrors]);
  
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
  
  // Show validation errors if they exist for the current tour
  if (isOffline && !processingNavigation && pathname.startsWith('/tour/')) {
    const tourIdMatch = pathname.match(/\/tour\/([^\/]+)/);
    if (tourIdMatch) {
      const tourId = tourIdMatch[1];
      const error = validationErrors[tourId];
      
      if (error) {
        return (
          <div className="fixed bottom-20 left-0 right-0 mx-auto z-50 max-w-md">
            <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-3 m-2 rounded shadow-md">
              <div className="flex">
                <div className="py-1">
                  <svg className="h-6 w-6 text-orange-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          </div>
        );
      }
    }
  }
  
  // This is normally an invisible component that just manages navigation
  return null;
} 