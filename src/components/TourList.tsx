'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { 
  checkIfTourIsDownloaded, 
  downloadTour, 
  deleteTour, 
  getAllDownloadedTours,
  isPwa
} from '@/services/offlineTourService';
import clsx from 'clsx';

// Add debug logging for navigation
const NAV_DEBUG = true;
const logNav = (...args: any[]) => {
  if (NAV_DEBUG) {
    console.log(`🧭 NAV [${new Date().toISOString().split('T')[1].split('.')[0]}]:`, ...args);
  }
};

// Add global type for navigation timestamp
declare global {
  interface Window {
    _navTimestamp?: number;
  }
}

// Tour type definition
export interface TourPoi {
  id: string;
  sequence_number: number;
  poi: {
    id: string;
    name: string;
    formatted_address: string;
    location: { lat: number; lng: number };
    types: string[];
    rating: number | null;
    photo_references: string[] | null;
    website?: string | null;
    thumbnail_url?: string | null;
    image_attribution?: string | null;
  };
}

export interface Tour {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  last_updated_at: string;
  start_location: { lat: number; lng: number; address?: string };
  end_location: { lat: number; lng: number; address?: string };
  return_to_start: boolean;
  transportation_mode: string;
  total_distance: number;
  total_duration: number;
  google_maps_url: string | null;
  tourPois: TourPoi[];
}

interface TourListProps {
  tours: Tour[];
  loading: boolean;
}

type DownloadProgressProps = {
  progress: number;
  status: string | undefined;
  onCancel?: () => void;
};

function DownloadProgress({ progress, status, onCancel }: DownloadProgressProps) {
  // Track time since last progress update to detect stuck downloads
  const [timeWithNoProgress, setTimeWithNoProgress] = useState(0);
  const [lastProgress, setLastProgress] = useState(progress);
  const [showForceReset, setShowForceReset] = useState(false);
  
  // Check for stuck downloads
  useEffect(() => {
    if (progress !== lastProgress) {
      // Progress is updating, reset counter
      setTimeWithNoProgress(0);
      setLastProgress(progress);
      setShowForceReset(false);
    } else {
      // Set up interval to track stuck progress
      const interval = setInterval(() => {
        setTimeWithNoProgress(prev => {
          const newTime = prev + 1;
          // If no progress for 15 seconds, show force reset option
          if (newTime >= 15 && !showForceReset) {
            setShowForceReset(true);
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [progress, lastProgress, showForceReset]);

  return (
    <div className="w-full mt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-500">
          {status || 'Downloading...'}
          {timeWithNoProgress > 5 && (
            <span className="ml-1 text-amber-500">
              {timeWithNoProgress > 30 ? '(Stuck?)' : `(${timeWithNoProgress}s)`}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {showForceReset && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Force reset this download? This will clear any partial data.')) {
                  // Clear IndexedDB for this tour
                  if (window.indexedDB) {
                    window.indexedDB.deleteDatabase('offline-audio-guide');
                  }
                  
                  // Force reload the page
                  window.location.reload();
                }
              }}
              className="text-xs font-medium text-amber-600 hover:text-amber-800 mr-2"
            >
              Force Reset
            </button>
          )}
          {onCancel && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            timeWithNoProgress > 15 
              ? 'bg-amber-500' 
              : 'bg-gradient-to-r from-orange-500 to-pink-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function TourList({ tours, loading }: TourListProps) {
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [newTourName, setNewTourName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [offlineStatus, setOfflineStatus] = useState<boolean>(false);
  const [downloadedTours, setDownloadedTours] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { progress: number; status?: string }>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [isPwaMode, setIsPwaMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [downloadControllers, setDownloadControllers] = useState<Record<string, AbortController>>({});

  // Check if we're in PWA mode
  useEffect(() => {
    setIsPwaMode(isPwa());
  }, []);

  // Check if we're offline
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      setOfflineStatus(!navigator.onLine);
    };

    // Set initial status
    setOfflineStatus(!navigator.onLine);

    // Add event listeners
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // Check which tours are downloaded
  useEffect(() => {
    const checkDownloadedTours = async () => {
      try {
        const tours = await getAllDownloadedTours();
        console.log("Downloaded tours loaded:", tours.length);
        const tourIds = tours.map(tour => tour.id);
        setDownloadedTours(tourIds);
      } catch (error) {
        console.error('Error checking downloaded tours:', error);
      }
    };

    checkDownloadedTours();
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Handle downloading a tour
  const handleDownloadTour = async (tour: Tour, audioData: Record<string, any>) => {
    try {
      setDownloading({ ...downloading, [tour.id]: true });
      setDownloadProgress(prev => ({
        ...prev,
        [tour.id]: { progress: 0, status: 'Initializing download...' }
      }));
      
      await downloadTour(
        tour,
        audioData,
        (progress, status) => {
          setDownloadProgress(prev => ({
            ...prev,
            [tour.id]: { progress, status }
          }));
        }
      );
      
      setDownloading({ ...downloading, [tour.id]: false });
      setDownloadedTours(prev => [...prev, tour.id]);
      
      // Clear progress after a delay
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[tour.id];
          return newProgress;
        });
      }, 2000);
    } catch (error) {
      console.error('Error downloading tour:', error);
      setDownloading({ ...downloading, [tour.id]: false });
    }
  };

  // Handle deleting a downloaded tour
  const handleDeleteDownload = async (tourId: string, tourName: string) => {
    try {
      await deleteTour(tourId);
      setDownloadedTours(prev => prev.filter(id => id !== tourId));
    } catch (error) {
      console.error('Error deleting downloaded tour:', error);
    }
  };

  const toggleExpand = (tourId: string) => {
    setExpandedTourId(expandedTourId === tourId ? null : tourId);
  };

  const startRenaming = (tourId: string, currentName: string) => {
    setEditingTourId(tourId);
    setNewTourName(currentName);
  };

  const cancelRenaming = () => {
    setEditingTourId(null);
    setNewTourName('');
  };

  const confirmDelete = (tourId: string) => {
    setShowDeleteConfirm(tourId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const deleteTour = async (tourId: string) => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete tour');
      }
      
      // Use filter to create a new array without the deleted tour
      const updatedTours = tours.filter(tour => tour.id !== tourId);
      
      // Update the tours array immutably
      if (tours.length !== updatedTours.length) {
        // Replace the content of the tours array without changing the reference
        tours.splice(0, tours.length, ...updatedTours);
      }
      
      // Clear any expanded or editing state related to this tour
      if (expandedTourId === tourId) {
        setExpandedTourId(null);
      }
      
      toast.success('Tour deleted successfully');
      setShowDeleteConfirm(null);
      
      // Don't reload the entire list
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete tour');
    } finally {
      setIsDeleting(false);
    }
  };

  const saveTourName = async (tourId: string) => {
    if (!newTourName.trim()) {
      toast.error('Tour name cannot be empty');
      return;
    }
    
    setIsRenaming(true);
    
    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newTourName.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tour name');
      }
      
      // Update the local tour list without refreshing
      const updatedTour = tours.find(tour => tour.id === tourId);
      if (updatedTour) {
        updatedTour.name = newTourName.trim();
      }
      
      toast.success('Tour renamed successfully');
      setEditingTourId(null);
      
      // Don't reload the entire list
    } catch (error) {
      console.error('Error renaming tour:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename tour');
    } finally {
      setIsRenaming(false);
    }
  };

  const formatDuration = (minutes: number) => {
    console.log(`🕒 DEBUG ETA (TourList): Formatting duration from raw value: ${minutes} minutes`);
    
    // Ensure we have a positive value
    const positiveMinutes = Math.max(0, minutes);
    
    // Now treat input as minutes (not seconds)
    const hours = Math.floor(positiveMinutes / 60);
    const mins = Math.round(positiveMinutes % 60);
    
    let formattedResult = '';
    if (hours > 0) {
      formattedResult = `${hours}h ${mins}m`;
    } else {
      // Show exact minutes value
      formattedResult = `${mins} min`;
    }
    
    console.log(`🕒 DEBUG ETA (TourList): Formatted result: ${formattedResult} (from ${hours}h ${mins}m)`);
    return formattedResult;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const getTransportIcon = (mode: string) => {
    switch (mode.toLowerCase()) {
      case 'walking':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4v16M20 10l-3.5 8-7-4" />
          </svg>
        );
      case 'driving':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M5 9l2 -4h8l2 4" />
            <path d="M5 9h12v5h-3" />
          </svg>
        );
      case 'transit':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
            <path d="M16 9m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
            <path d="M7.5 11h5.5" />
            <path d="M7 5l-4 7h9l-4 7" />
            <path d="M22 5l-4 7h-9" />
          </svg>
        );
      case 'bicycling':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M19 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M12 17h-2a2 2 0 0 1 -2 -2v-6m2 6l5 -10l3 4" />
            <path d="M12 17l-3 -3l2 -2l5 1l-3 3" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2c-3.87 0 -7 3.13 -7 7c0 5.25 7 13 7 13s7 -7.75 7 -13c0 -3.87 -3.13 -7 -7 -7z" />
            <path d="M12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" />
          </svg>
        );
    }
  };
  
  const getGoogleMapsUrl = (tour: Tour) => {
    if (tour.google_maps_url) return tour.google_maps_url;
    
    // If google_maps_url is not available, create one from the tour data
    let url = 'https://www.google.com/maps/dir/?api=1';
    
    // Add origin - use address if available, otherwise coordinates
    if (tour.start_location.address) {
      url += `&origin=${encodeURIComponent(tour.start_location.address)}`;
    } else {
      url += `&origin=${tour.start_location.lat},${tour.start_location.lng}`;
    }
    
    // Add destination - use address if available, otherwise coordinates
    if (tour.return_to_start) {
      if (tour.start_location.address) {
        url += `&destination=${encodeURIComponent(tour.start_location.address)}`;
      } else {
        url += `&destination=${tour.start_location.lat},${tour.start_location.lng}`;
      }
    } else {
      if (tour.end_location.address) {
        url += `&destination=${encodeURIComponent(tour.end_location.address)}`;
      } else {
        url += `&destination=${tour.end_location.lat},${tour.end_location.lng}`;
      }
    }
    
    // Add POIs as waypoints
    if (tour.tourPois.length > 0) {
      const waypoints = tour.tourPois
        .sort((a, b) => a.sequence_number - b.sequence_number)
        .map(poi => {
          if (poi.poi.formatted_address) {
            return encodeURIComponent(poi.poi.formatted_address);
          } else {
            return `${poi.poi.location.lat},${poi.poi.location.lng}`;
          }
        })
        .join('|');
      
      url += `&waypoints=${waypoints}`;
    }
    
    // Add travel mode
    if (tour.transportation_mode) {
      const travelMode = tour.transportation_mode.toLowerCase();
      url += `&travelmode=${travelMode}`;
    }
    
    return url;
  };

  // Format location data for display
  const formatLocation = (location: any): string => {
    if (!location) return 'Unknown';
    
    // If we have an address, use it
    if (location.address) {
      return location.address;
    }
    
    // Fallback to coordinates
    const lat = typeof location.lat === 'number' ? location.lat.toFixed(6) : '?';
    const lng = typeof location.lng === 'number' ? location.lng.toFixed(6) : '?';
    return `${lat}, ${lng}`;
  };

  // Handle download of tour for offline use
  const handleDownload = async (tour: Tour) => {
    try {
      // Clear any previous errors
      setDownloadErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[tour.id];
        return newErrors;
      });

      // Set initial progress and downloading state
      setDownloading(prev => ({ ...prev, [tour.id]: true }));
      setDownloadProgress(prev => ({
        ...prev,
        [tour.id]: { progress: 0, status: 'Initializing download...' }
      }));

      // Pre-check cache API availability
      if (!('caches' in window)) {
        throw new Error('Cache API not available in this browser. Offline functionality not supported.');
      }

      // Pre-check IndexedDB availability
      if (!('indexedDB' in window)) {
        throw new Error('IndexedDB not available. Offline functionality not supported.');
      }

      // Create a new AbortController
      const controller = new AbortController();
      setDownloadControllers(prev => ({
        ...prev,
        [tour.id]: controller
      }));

      // Fetch audio data from our API with a timeout
      setDownloadProgress(prev => ({
        ...prev,
        [tour.id]: { progress: 5, status: 'Fetching audio data...' }
      }));
      
      const fetchWithTimeout = async () => {
        const fetchTimeoutId = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(`/api/tours/${tour.id}/audio-data`, {
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          clearTimeout(fetchTimeoutId);
          return response;
        } catch (error) {
          clearTimeout(fetchTimeoutId);
          throw error;
        }
      };

      // Get the audio data
      const response = await fetchWithTimeout();
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio data: ${response.status} ${response.statusText}`);
      }
      
      let audioData;
      try {
        const responseData = await response.json();
        
        if (!responseData.success) {
          throw new Error(responseData.error || 'Failed to fetch audio data');
        }
        
        // Extract the audioData property from the response
        audioData = responseData.audioData;
        
        if (!audioData || typeof audioData !== 'object') {
          throw new Error('Invalid audio data format received from server');
        }
      } catch (error) {
        throw new Error('Failed to parse audio data response');
      }
      
      // Update status
      setDownloadProgress(prev => ({
        ...prev,
        [tour.id]: { progress: 10, status: 'Starting download...' }
      }));
      
      // Download the tour using our offlineTourService with error reporting
      await downloadTour(tour, audioData, (progress, status) => {
        // Update UI progress
        setDownloadProgress(prev => ({
          ...prev,
          [tour.id]: { progress, status }
        }));
        
        // Check for stuck download (100% progress for too long)
        if (progress === 100) {
          const DOWNLOAD_STUCK_TIMEOUT = 10000; // 10 seconds
          const stuckTimeoutId = setTimeout(() => {
            console.error(`Download appears stuck at 100% for tour ${tour.id}`);
            // Force clear the progress to fix UI
            setDownloadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[tour.id];
              return newProgress;
            });
            
            // Show error
            setDownloadErrors(prev => ({
              ...prev,
              [tour.id]: 'Download completed but app did not update. Try refreshing the page.'
            }));
          }, DOWNLOAD_STUCK_TIMEOUT);
          
          // Clean up the timeout if progress changes or component unmounts
          return () => clearTimeout(stuckTimeoutId);
        }
      });
      
      // When download is complete, update downloaded tours list
      setDownloadedTours(prev => [...prev, tour.id]);
      
      toast.success('Tour downloaded successfully!');
      
      // Clear progress after a short delay
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[tour.id];
          return newProgress;
        });
      }, 3000);
      
      // Reset downloading state
      setDownloading(prev => ({ ...prev, [tour.id]: false }));
      
      // Clear the controller
      setDownloadControllers(prev => {
        const newControllers = { ...prev };
        delete newControllers[tour.id];
        return newControllers;
      });
    } catch (error) {
      console.error('Failed to download tour:', error);
      
      // Show error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      
      let userErrorMessage = errorMessage;
      
      // Provide more helpful messages for common errors
      if (errorMessage.includes('Service worker')) {
        userErrorMessage = 'Download failed in dev mode. This feature works better in production.';
      } else if (errorMessage.includes('IndexedDB')) {
        userErrorMessage = 'Storage error: Your browser may be in private mode or has limited storage.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userErrorMessage = 'Network error: Check your connection and try again.';
      } else if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
        userErrorMessage = 'Download timed out. Please try again.';
      } else if (errorMessage.includes('Cache API')) {
        userErrorMessage = 'Your browser doesn\'t support offline mode.';
      }
      
      // Clear progress
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[tour.id];
        return newProgress;
      });
      
      // Set error
      setDownloadErrors(prev => ({
        ...prev,
        [tour.id]: userErrorMessage
      }));
      
      // Reset downloading state
      setDownloading(prev => ({ ...prev, [tour.id]: false }));
      
      // Show toast notification
      toast.error(`Download failed: ${userErrorMessage}`);
      
      // Clear the controller
      setDownloadControllers(prev => {
        const newControllers = { ...prev };
        delete newControllers[tour.id];
        return newControllers;
      });
    }
  };

  // Cancel download
  const handleCancelDownload = (tourId: string) => {
    const controller = downloadControllers[tourId];
    if (controller) {
      controller.abort();
      
      // Remove the controller from state
      setDownloadControllers(prev => {
        const newControllers = { ...prev };
        delete newControllers[tourId];
        return newControllers;
      });
      
      // Clear progress display
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[tourId];
        return newProgress;
      });
      
      console.log('Download cancelled');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-900/60 p-6 rounded-lg animate-pulse border border-purple-900/50">
            <div className="h-6 bg-slate-800 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-slate-800 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className="bg-slate-900/60 p-8 rounded-lg text-center border border-purple-900/50">
        <h3 className="text-lg font-medium text-white mb-2">No tours yet</h3>
        <p className="text-purple-100/80 mb-4">Create your first personalized tour to see it here!</p>
      </div>
    );
  }

  // Filter tours when offline to only show downloaded ones
  const displayedTours = offlineStatus 
    ? tours.filter(tour => downloadedTours.includes(tour.id)) 
    : tours;

  if (offlineStatus && displayedTours.length === 0) {
    return (
      <div className="bg-slate-900/60 p-8 rounded-lg text-center border border-purple-900/50">
        <div className="mb-4">
          <svg className="w-12 h-12 mx-auto text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">You're Offline</h3>
        <p className="text-purple-100/80 mb-2">No downloaded tours available.</p>
        <p className="text-purple-100/60 text-sm mb-6">Connect to the internet to see your tours or download tours for offline use.</p>
        
        <div className="text-left p-4 bg-slate-800/80 rounded-lg border border-orange-900/30 mb-4">
          <h4 className="font-medium text-orange-300 mb-2">Troubleshooting Options:</h4>
          <ul className="list-disc pl-5 text-purple-100/70 text-sm space-y-2">
            <li>Try refreshing the page</li>
            <li>Check that your downloaded tours are in IndexedDB (via DevTools &gt; Application &gt; IndexedDB)</li>
            <li>If you know you've downloaded tours but they're not showing:</li>
          </ul>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('bypassOfflineCheck', 'true');
                  window.location.reload();
                }
              }}
              className="bg-orange-700 hover:bg-orange-600 text-white py-2 px-4 rounded-md text-sm"
            >
              Force Show All Tours
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {offlineStatus && (
        <div className="bg-orange-900/30 border border-orange-800/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-orange-300">You're offline. {downloadedTours.length > 0 ? `Showing ${downloadedTours.length} downloaded tours.` : 'No tours found.'}</span>
            </div>
            <button
              onClick={async () => {
                try {
                  const tours = await getAllDownloadedTours();
                  const tourIds = tours.map(tour => tour.id);
                  setDownloadedTours(tourIds);
                  if (tourIds.length === 0) {
                    alert('No downloaded tours found in storage. Connect to the internet to download tours for offline use.');
                  }
                } catch (error) {
                  console.error('Error refreshing downloaded tours:', error);
                  alert('Error checking downloaded tours. Try again or check your browser storage.');
                }
              }}
              className="text-sm bg-orange-800/50 hover:bg-orange-700/50 text-orange-200 px-3 py-1 rounded-md"
            >
              Refresh List
            </button>
          </div>
        </div>
      )}
      
      {displayedTours.map((tour) => (
        <div 
          key={tour.id} 
          className="bg-slate-900/60 border border-purple-900/50 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all relative group backdrop-blur-sm"
        >
          {/* Subtle accent border at the top of the card */}
          <div className="h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"></div>
          
          {/* Centered confirmation dialog with dark overlay */}
          {showDeleteConfirm === tour.id && (
            <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-sm bg-slate-900/80">
              <div className="bg-slate-900 border border-purple-900/50 rounded-md shadow-lg py-3 px-4 text-sm z-30 relative max-w-[220px]">
                <p className="text-gray-100 mb-3 text-center font-medium">Delete this tour?</p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-3 py-1 text-xs bg-slate-800/70 hover:bg-slate-700/70 text-gray-200 rounded transition-colors"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteTour(tour.id)}
                    className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-200 rounded transition-colors flex items-center"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-red-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-4">
            {/* Title row layout */}
            <div className="flex items-center justify-between mb-2">
              {editingTourId === tour.id ? (
                <div className="flex-1 mr-2">
                  <input
                    type="text"
                    value={newTourName}
                    onChange={(e) => setNewTourName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-purple-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
                    placeholder="Tour name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveTourName(tour.id);
                      } else if (e.key === 'Escape') {
                        cancelRenaming();
                      }
                    }}
                  />
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() => saveTourName(tour.id)}
                      disabled={isRenaming}
                      className="text-white bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 px-3 py-1 rounded-md text-sm font-medium flex items-center shadow-sm shadow-orange-900/20"
                    >
                      {isRenaming ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      onClick={cancelRenaming}
                      disabled={isRenaming}
                      className="text-gray-200 bg-slate-800/70 hover:bg-slate-700/70 px-3 py-1 rounded-md text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 flex items-center">
                    <h3 
                      className="text-lg font-medium text-white hover:text-orange-400 cursor-pointer truncate"
                      onClick={() => toggleExpand(tour.id)}
                    >
                      {tour.name}
                    </h3>
                    
                    {/* Mobile-only edit/delete icons next to title */}
                    <div className="flex sm:hidden items-center ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRenaming(tour.id, tour.name);
                        }}
                        className="p-1 text-gray-400 hover:text-orange-400 hover:bg-slate-800/70 rounded-full"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(tour.id);
                        }}
                        className="p-1 ml-1 text-gray-400 hover:text-red-400 hover:bg-slate-800/70 rounded-full"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Desktop edit/delete/expand buttons */}
                  <div className="flex items-center">
                    {/* Desktop-only edit/delete buttons */}
                    <div className="hidden sm:flex items-center group">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRenaming(tour.id, tour.name);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-orange-400 hover:bg-slate-800/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Rename tour"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(tour.id);
                        }}
                        className="ml-1 p-1 text-gray-400 hover:text-red-400 hover:bg-slate-800/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Delete tour"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Expand button - visible for all devices */}
                    <button
                      onClick={() => toggleExpand(tour.id)}
                      className="h-8 w-8 flex items-center justify-center ml-2"
                      title={expandedTourId === tour.id ? "Collapse" : "Expand"}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-5 w-5 transition-transform text-gray-400 hover:text-orange-400 ${expandedTourId === tour.id ? 'transform rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Description section */}
            {tour.description && (
              <p className="text-purple-100/80 text-sm mb-2 line-clamp-2">{tour.description}</p>
            )}
            
            {/* Action buttons row - improved mobile buttons */}
            <div className="flex items-center space-x-2 mb-3 mt-2">
              {/* Start Button */}
              <Link
                href={`/tour/${tour.id}`}
                className="flex-1 inline-flex items-center justify-center text-white text-xs font-medium bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-sm shadow-orange-900/20"
                onClick={() => {
                  logNav(`Navigating to tour: ${tour.id}`);
                  window._navTimestamp = Date.now();
                }}
              >
                <svg className="w-3 h-3 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span className="whitespace-nowrap">Start</span>
              </Link>
              
              {/* Download button - matching Start button */}
              {isPwaMode && !downloading[tour.id] && !downloadProgress[tour.id] && (
                !downloadedTours.includes(tour.id) ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(tour);
                    }}
                    className="flex-1 inline-flex items-center justify-center text-white text-xs font-medium bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-sm shadow-orange-900/20 active:scale-95"
                    disabled={!isOnline}
                  >
                    <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="whitespace-nowrap">Download</span>
                  </button>
                ) : (
                  <button
                    disabled={downloading[tour.id] || Boolean(downloadProgress[tour.id])}
                    className="flex-1 inline-flex items-center justify-center text-green-300 hover:text-green-200 text-xs font-medium bg-green-900/30 hover:bg-green-900/50 px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-sm shadow-green-900/20"
                  >
                    <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="whitespace-nowrap">Downloaded</span>
                  </button>
                )
              )}
            </div>
                
            {/* Download progress indicator */}
            {isPwaMode && (downloadProgress[tour.id] || downloadErrors[tour.id]) && (
              <div className="mb-3 mt-1">
                {/* Error message */}
                {downloadErrors[tour.id] && (
                  <div className="text-xs text-red-500 mb-1">
                    Error: {downloadErrors[tour.id]}
                    <button 
                      className="ml-2 text-blue-500 hover:text-blue-700" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDownloadErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors[tour.id];
                          return newErrors;
                        });
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                
                {/* Download progress */}
                {downloadProgress[tour.id] && (
                  <DownloadProgress 
                    progress={downloadProgress[tour.id].progress} 
                    status={downloadProgress[tour.id].status}
                    onCancel={() => handleCancelDownload(tour.id)}
                  />
                )}
              </div>
            )}

            {/* Tour info row */}
            <div className="flex flex-wrap gap-2 items-center text-sm text-purple-100/80">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>{formatDate(tour.created_at)}</span>
              </div>
              
              <div className="flex items-center ml-3">
                <svg className="w-4 h-4 mr-1 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2c-3.87 0 -7 3.13 -7 7c0 5.25 7 13 7 13s7 -7.75 7 -13c0 -3.87 -3.13 -7 -7 -7z" />
                  <path d="M12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" />
                </svg>
                <span>{(tour.total_distance).toFixed(1)} km</span>
              </div>
              
              <div className="flex items-center ml-3">
                <svg className="w-4 h-4 mr-1 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{formatDuration(tour.total_duration)}</span>
              </div>
              
              <div className="flex items-center ml-3">
                <span className="text-orange-400 mr-1">{getTransportIcon(tour.transportation_mode)}</span>
                <span className="capitalize">{tour.transportation_mode}</span>
              </div>
              
              <div className="flex items-center ml-3">
                <span className="text-xs px-2 py-1 bg-orange-900/30 text-orange-300 rounded-full border border-orange-700/30">
                  {tour.tourPois?.length || 0} stops
                </span>
              </div>
            </div>
          </div>

          {expandedTourId === tour.id && (
            <div className="border-t border-purple-900/50 p-4">
              {/* Tour in Chronological Order: Start > Stops > End */}
              
              {/* Start Location Section */}
              <div className="mb-6 bg-slate-900/60 p-3 rounded-lg border border-purple-900/30">
                <div className="flex items-start">
                  <div className="min-w-8 mt-1 mr-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300">Start Location</p>
                    <p className="text-purple-100/80 text-sm">{formatLocation(tour.start_location)}</p>
                  </div>
                </div>
              </div>
              
              {/* Tour Stops Section */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-300 flex items-center">
                  <svg className="w-5 h-5 mr-1 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-8-4.5-8-11.8a8 8 0 0 1 16 0c0 7.3-8 11.8-8 11.8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Tour Stops
                </h4>
                <div className="space-y-2">
                  {tour.tourPois
                    .sort((a, b) => a.sequence_number - b.sequence_number)
                    .map((tourPoi) => (
                      <div key={tourPoi.id} className="flex items-start p-2 hover:bg-slate-800/50 rounded-md transition-colors">
                        <div className="bg-pink-900/40 text-pink-300 rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0 border border-pink-700/30">
                          {tourPoi.sequence_number + 1}
                        </div>
                        <div>
                          <h5 className="text-white font-medium">{tourPoi.poi.name}</h5>
                          <p className="text-purple-100/80 text-sm">{tourPoi.poi.formatted_address}</p>
                          {tourPoi.poi.rating && (
                            <div className="flex items-center mt-1">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg 
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.round(tourPoi.poi.rating || 0) ? 'text-yellow-400' : 'text-gray-600'}`}
                                    xmlns="http://www.w3.org/2000/svg" 
                                    viewBox="0 0 20 20" 
                                    fill="currentColor"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-xs text-gray-400 ml-1">{tourPoi.poi.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* End Location Section */}
              <div className="mb-6 bg-slate-900/60 p-3 rounded-lg border border-purple-900/30">
                {!tour.return_to_start ? (
                  <div className="flex items-start">
                    <div className="min-w-8 mt-1 mr-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">End Location</p>
                      <p className="text-purple-100/80 text-sm">{formatLocation(tour.end_location)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start">
                    <div className="min-w-8 mt-1 mr-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-300">Return to Start</p>
                      <p className="text-purple-100/80 text-sm">This tour returns to the starting point</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex flex-wrap gap-2 justify-between">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <a 
                    href={getGoogleMapsUrl(tour)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-300 hover:text-orange-200 text-sm font-medium inline-flex items-center justify-center bg-orange-900/30 hover:bg-orange-900/50 px-3 py-3 sm:py-2 rounded-md transition-colors border border-orange-800/30"
                    aria-label="View Route in Google Maps"
                  >
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span className="sm:inline">View Route in Google Maps</span>
                  </a>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startRenaming(tour.id, tour.name);
                    }}
                    className="text-gray-300 hover:text-gray-200 text-sm font-medium inline-flex items-center justify-center bg-slate-800/70 hover:bg-slate-700/70 px-3 py-3 sm:py-2 rounded-md transition-colors cursor-pointer"
                    aria-label="Rename Tour"
                  >
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span className="sm:inline">Rename Tour</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(tour.id);
                    }}
                    className="text-gray-300 hover:text-red-300 text-sm font-medium inline-flex items-center justify-center bg-slate-800/70 hover:bg-slate-700/70 px-3 py-3 sm:py-2 rounded-md transition-colors cursor-pointer"
                    aria-label="Delete Tour"
                  >
                    <svg className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="sm:inline">Delete Tour</span>
                  </button>
                  
                  {/* Only show download button in PWA mode */}
                  {isPwaMode && (
                    <>
                      {downloading[tour.id] ? (
                        <div className="mt-2 sm:mt-0 sm:ml-2 w-full sm:w-auto">
                          <DownloadProgress 
                            progress={downloadProgress[tour.id]?.progress || 0} 
                            status={downloadProgress[tour.id]?.status}
                            onCancel={() => handleCancelDownload(tour.id)}
                          />
                        </div>
                      ) : downloadedTours.includes(tour.id) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              deleteTour(tour.id);
                              setDownloadedTours(prev => prev.filter(id => id !== tour.id));
                            } catch (error) {
                              console.error('Failed to delete tour:', error);
                              setDownloadErrors(prev => ({
                                ...prev,
                                [tour.id]: error instanceof Error ? error.message : 'Failed to delete tour'
                              }));
                            }
                          }}
                          className="mt-2 sm:mt-0 sm:ml-2 text-green-300 hover:text-green-200 text-xs sm:text-sm font-medium inline-flex items-center justify-center bg-green-900/30 hover:bg-green-900/50 px-3 py-2 rounded-md transition-colors cursor-pointer"
                          aria-label="Remove Offline Version"
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="sm:inline whitespace-nowrap">Downloaded</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(tour);
                          }}
                          className="mt-2 sm:mt-0 sm:ml-2 text-xs sm:text-sm font-medium inline-flex items-center justify-center bg-gradient-to-r from-orange-500 to-pink-500 text-white px-3 py-2 rounded-md transition-all hover:from-orange-600 hover:to-pink-600 active:scale-95"
                          aria-label="Download for Offline Use"
                          disabled={!isOnline}
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="sm:inline whitespace-nowrap">Download</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}