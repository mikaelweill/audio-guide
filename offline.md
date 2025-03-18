# Offline Tour Downloads - Implementation Plan

## Current State of Offline Functionality

The application now has enhanced offline support:

1. **Service Worker Implementation**:
   - Using `next-pwa` to generate and register a service worker
   - Custom service worker at `public/custom-sw.js` handles caching
   - Basic app shell files are cached during install
   - API responses for `/api/tours` use a cache-then-network strategy
   - Stable cache keys for audio content to handle changing presigned URLs

2. **Offline UI Components**:
   - `OfflineIndicator` component shows when the user is offline
   - `OfflineDetector` is used to include the indicator dynamically
   - Custom offline page (`offline.html`) is shown when navigating while offline
   - Network status check implemented in `public/js/network-check.js`
   - Added `DownloadTourButton` and `DownloadProgress` components
   - Integrated download functionality in the TourList component

3. **Backend Improvements**:
   - API endpoint `/api/tours/[id]/audio-data` correctly formats audio data from the Translation table
   - Fixed Next.js App Router dynamic route parameter handling
   - Proper error handling for missing data or database errors

4. **Robustness Improvements**:
   - Added service worker availability checking with retries
   - Implemented fallback for direct Cache API access when service worker isn't available
   - Better error messages to guide users through PWA installation
   - Graceful degradation when certain resources can't be cached

## Recent Fixes

1. **API Endpoint Fixes**:
   - Fixed the issue with accessing dynamic route parameters in Next.js App Router
   - Corrected database queries to use the Translation table instead of a non-existent PoiAudio table
   - Added proper field mapping for audio content types

2. **Service Worker Enhancements**:
   - Added retry mechanism for service worker availability
   - Created fallback for devices or browsers that don't support service workers
   - Improved error handling with more descriptive messages

3. **UI Refinements**:
   - Adjusted Start and Download button sizing and positioning
   - Made buttons properly responsive across different device sizes

## Remaining Tasks

1. **Testing**:
   - Test across different browsers (Chrome, Safari, Firefox)
   - Test with network off/on transitions
   - Test with multiple tours and large audio files

2. **Optimizations**:
   - Implement storage quota management
   - Add tour download size calculations before download
   - Optimize caching strategies for larger audio files

3. **User Experience**:
   - Add offline usage instructions
   - Improve visual feedback during download process
   - Create a "Download Manager" view to show all downloaded tours

## Technical Architecture

### Simplified Approach with Stable Cache Keys

Our solution uses a simplified approach to handle changing presigned URLs:

1. **Stable Cache Keys**: We use POI ID + audio type as stable cache keys
   - Example: `/offline-audio/[poiId]/brief` or `/offline-audio/[poiId]/detailed`
   - These stable keys don't change even when presigned URLs do

2. **Dual URL Strategy**:
   - When online: Use regular presigned URLs from Supabase
   - When offline or for downloaded tours: Use stable cache keys

3. **Caching System**:
   - Store content using the stable cache keys
   - Service worker intercepts requests to stable cache keys
   - Return cached content when offline

4. **Fallback Mechanism**:
   - Direct Cache API access when service worker is unavailable
   - Cross-browser compatibility improvements
   - Support for regular browsing mode (without PWA installation)

## Data Flow

1. User clicks "Download" for a tour
2. App fetches audio data from `/api/tours/[id]/audio-data` endpoint
3. The API retrieves audio paths from the Translation table
4. For each POI, the app:
   - Fetches audio files using the URL from the Translation table
   - Caches them using stable keys based on POI ID and content type
   - Updates download progress in the UI
5. Once complete, the tour and its resources are marked as available offline

## Usage

The offline functionality works best when the app is installed as a PWA, but will still function in a regular browser tab with some limitations. To get the full offline experience:

1. Install the app as a PWA:
   - In Chrome/Edge: Click the install icon in the address bar
   - In Safari (iOS): Use "Add to Home Screen" from the share menu
   
2. Download tours while online:
   - Browse to the tour you want to download
   - Click the "Download" button
   - Wait for the download to complete
   
3. Access downloaded tours offline:
   - Open the app even when offline
   - Go to your tours list
   - Tours marked as "Available offline" will work without internet connection

## Required Features for Offline Tour Downloads

To enable a complete offline tour experience, we need to:

1. **Tour Data Caching**:
   - Cache complete tour data including all POI details
   - Store tour route information
   - Cache images for POIs

2. **Audio Content Caching**:
   - Download and cache audio files for each POI
   - Support multiple audio levels (brief, detailed, in-depth)
   - Manage storage size limitations

3. **User Interface**:
   - Add "Download for Offline" button on tour pages
   - Show download progress indicators
   - Display which tours are available offline
   - Allow users to remove offline tours to free up space

4. **Storage Management**:
   - Track storage usage
   - Handle storage limits gracefully
   - Provide options to clear unnecessary cached data

## Technical Architecture

### Simplified Approach with Stable Cache Keys

Our solution will use a simplified approach to handle changing presigned URLs:

1. **Stable Cache Keys**: We'll use POI ID + audio type as stable cache keys
   - Example: `/offline-audio/[poiId]/brief` or `/offline-audio/[poiId]/detailed`
   - These stable keys don't change even when presigned URLs do

2. **Dual URL Strategy**:
   - When online: Use regular presigned URLs from Supabase
   - When offline or for downloaded tours: Use stable cache keys

3. **Caching System**:
   - Store content using the stable cache keys
   - Service worker intercepts requests to stable cache keys
   - Return cached content when offline

### Data Model

```typescript
// Interface for tracking downloaded tours
interface DownloadedTour {
  id: string;
  name: string;
  downloadDate: string;
  lastUpdated: string;
  poiCount: number;
  audioFilesCount: number;
}

// Interface for cached resources
interface CachedResource {
  url: string;      // Original URL (presigned URL)
  cacheKey: string; // Stable cache key
}
```

### Storage Mechanism

We'll use a combination of:

1. **Cache API**: For storing actual audio files and images
2. **IndexedDB**: For tracking downloaded tours and their metadata
3. **Service Worker**: For intercepting requests and handling offline access

## Implementation Plan

### 1. Offline Tour Service

Create a service to manage tour downloads and caching:

```typescript
// src/services/offlineTourService.ts
import { Tour } from '@/components/TourList';

// Create stable cache keys for audio files
function createAudioCacheKey(poiId: string, audioType: 'brief' | 'detailed' | 'complete'): string {
  return `/offline-audio/${poiId}/${audioType}`;
}

// Create stable cache keys for images
function createImageCacheKey(poiId: string): string {
  return `/offline-images/${poiId}`;
}

// Download a tour for offline use
export async function downloadTour(tour: Tour, audioData: Record<string, any>): Promise<void> {
  if (!navigator.serviceWorker.controller) {
    throw new Error('Service worker not active');
  }
  
  // Create array of resources to cache
  const resourcesToCache = [];
  
  // Add the tour API data
  resourcesToCache.push({
    url: `/api/tours/${tour.id}`,
    cacheKey: `/api/tours/${tour.id}`
  });
  
  // Add each POI's audio files and images
  for (const tourPoi of tour.tourPois) {
    const poi = tourPoi.poi;
    const poiId = poi.id;
    const poiAudio = audioData[poiId];
    
    // Add thumbnail image if available
    if (poi.thumbnail_url) {
      resourcesToCache.push({
        url: poi.thumbnail_url,
        cacheKey: createImageCacheKey(poiId)
      });
    }
    
    // Add audio files with stable cache keys
    if (poiAudio?.audioFiles?.coreAudioUrl) {
      resourcesToCache.push({
        url: poiAudio.audioFiles.coreAudioUrl,
        cacheKey: createAudioCacheKey(poiId, 'brief')
      });
    }
    
    if (poiAudio?.audioFiles?.secondaryAudioUrl) {
      resourcesToCache.push({
        url: poiAudio.audioFiles.secondaryAudioUrl,
        cacheKey: createAudioCacheKey(poiId, 'detailed')
      });
    }
    
    if (poiAudio?.audioFiles?.tertiaryAudioUrl) {
      resourcesToCache.push({
        url: poiAudio.audioFiles.tertiaryAudioUrl,
        cacheKey: createAudioCacheKey(poiId, 'complete')
      });
    }
  }
  
  // Store the tour data in IndexedDB
  const downloadedTour = {
    id: tour.id,
    name: tour.name,
    downloadDate: new Date().toISOString(),
    lastUpdated: tour.last_updated_at,
    poiCount: tour.tourPois.length,
    audioFilesCount: resourcesToCache.filter(r => r.cacheKey.includes('/offline-audio/')).length
  };
  
  await storeDownloadedTour(tour.id, downloadedTour);
  
  // Send message to service worker to cache resources
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve();
      }
    };
    
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_TOUR_RESOURCES',
      tourId: tour.id,
      resources: resourcesToCache
    }, [messageChannel.port2]);
  });
}

// Get audio URL - handles both online and offline scenarios
export async function getAudioUrl(
  poiId: string, 
  audioType: 'brief' | 'detailed' | 'complete', 
  onlineUrl: string, 
  tourId: string
): Promise<string> {
  // Check if this tour is downloaded
  const isDownloaded = await isTourDownloaded(tourId);
  const isOnline = navigator.onLine;
  
  if (!isOnline || isDownloaded) {
    // Return the stable cache key URL
    return createAudioCacheKey(poiId, audioType);
  }
  
  // Otherwise use the online URL (which will be a presigned URL)
  return onlineUrl;
}

// Plus IndexedDB helper functions
// ...
```

### 2. Service Worker Enhancements

Modify the service worker to handle stable cache keys:

```javascript
// public/custom-sw.js - add this code

// Create a separate cache for offline tours
const offlineToursCache = 'offline-tours-v1';

// Listen for messages to cache resources
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_TOUR_RESOURCES') {
    const { tourId, resources } = event.data;
    
    event.waitUntil(
      caches.open(offlineToursCache).then(async (cache) => {
        console.log(`[SW] Caching ${resources.length} resources for tour ${tourId}`);
        
        // Process each resource
        const promises = resources.map(async ({ url, cacheKey }) => {
          try {
            // Fetch the resource from the network
            const response = await fetch(url);
            if (!response || response.status !== 200) {
              throw new Error(`Failed to fetch ${url}`);
            }
            
            // Store with the stable cache key
            await cache.put(new Request(cacheKey), response.clone());
            return true;
          } catch (error) {
            console.error(`[SW] Failed to cache ${url}:`, error);
            return false;
          }
        });
        
        // Wait for all caching to complete
        const results = await Promise.all(promises);
        const successCount = results.filter(Boolean).length;
        
        // Report back to the client
        if (event.ports?.[0]) {
          event.ports[0].postMessage({
            success: true,
            message: `Cached ${successCount}/${resources.length} resources`
          });
        }
      }).catch(error => {
        console.error('[SW] Caching error:', error);
        if (event.ports?.[0]) {
          event.ports[0].postMessage({ error: error.message });
        }
      })
    );
  }
  
  // Handle message to remove tour cache
  if (event.data.type === 'REMOVE_TOUR_CACHE') {
    const { tourId } = event.data;
    
    event.waitUntil(
      caches.open(offlineToursCache).then(async (cache) => {
        // Get all cached requests
        const keys = await cache.keys();
        
        // Filter keys that belong to this tour (API request matches tour ID)
        const tourKeys = keys.filter(key => {
          return key.url.includes(`/api/tours/${tourId}`);
        });
        
        // Delete tour API data
        await Promise.all(tourKeys.map(key => cache.delete(key)));
        
        // For audio and image files, we'll rely on the IndexedDB cleanup
        // to remove unused files during maintenance
      })
    );
  }
});

// Add/modify the fetch handler to look for our stable cache keys
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is one of our stable cache key URLs
  const isOfflineAudioRequest = url.pathname.startsWith('/offline-audio/');
  const isOfflineImageRequest = url.pathname.startsWith('/offline-images/');
  const isOfflineRequest = isOfflineAudioRequest || isOfflineImageRequest;
  
  if (isOfflineRequest) {
    event.respondWith(
      caches.open(offlineToursCache).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            return response;
          }
          return new Response('Resource not available offline', { status: 404 });
        });
      })
    );
  }
  
  // Also handle tour API requests
  if (url.pathname.startsWith('/api/tours/')) {
    event.respondWith(
      caches.open(offlineToursCache).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Try network first when online, cache when offline
          return fetch(event.request)
            .then(networkResponse => {
              // Update cache with fresh response
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Return cached response when offline
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Return fallback when no cache exists
              return new Response(JSON.stringify({
                success: false,
                message: 'You are offline and this tour is not available offline'
              }), { 
                headers: { 'Content-Type': 'application/json' } 
              });
            });
        });
      })
    );
  }
});
```

### 3. Download Button Component

Create a component for downloading tours:

```tsx
// src/components/Offline/DownloadTourButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { downloadTour, isTourDownloaded, deleteTour } from '@/services/offlineTourService';
import { Tour } from '@/components/TourList';

interface DownloadTourButtonProps {
  tour: Tour;
  audioData: Record<string, any>;
}

export default function DownloadTourButton({ tour, audioData }: DownloadTourButtonProps) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check download status
  useEffect(() => {
    async function checkStatus() {
      const status = await isTourDownloaded(tour.id);
      setIsDownloaded(status);
    }
    checkStatus();
  }, [tour.id]);
  
  // Handle download
  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    
    try {
      await downloadTour(tour, audioData);
      setIsDownloaded(true);
    } catch (error) {
      console.error('Download failed:', error);
      setError(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteTour(tour.id);
      setIsDownloaded(false);
    } catch (error) {
      console.error('Delete failed:', error);
      setError(error instanceof Error ? error.message : 'Delete failed');
    }
  };
  
  return (
    <div className="mt-4">
      {isDownloaded ? (
        <div className="flex flex-col space-y-2">
          <div className="bg-green-900/20 border border-green-800/30 rounded-md p-2 text-green-400 text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
            </svg>
            Available offline
          </div>
          <button
            onClick={handleDelete}
            className="py-2 px-3 bg-red-800/30 hover:bg-red-800/50 text-red-300 rounded-md flex items-center justify-center text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Remove offline version
          </button>
        </div>
      ) : (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`w-full py-2 px-3 ${isDownloading ? 'bg-indigo-800/50' : 'bg-indigo-800/30 hover:bg-indigo-800/50'} text-indigo-300 rounded-md flex items-center justify-center`}
        >
          {isDownloading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Downloading...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Download for offline use
            </>
          )}
        </button>
      )}
      
      {error && (
        <div className="mt-2 text-red-400 text-sm">
          Error: {error}
        </div>
      )}
    </div>
  );
}
```

### 4. Audio Player Updates

Modify the audio player to work with offline content:

```tsx
// Update the playAudio function in your tour page component
import { getAudioUrl } from '@/services/offlineTourService';

const playAudio = useCallback(async (originalUrl: string, label: string, poiId: string, audioType: 'brief' | 'detailed' | 'complete') => {
  console.log(`Attempting to play audio: ${label} from URL: ${originalUrl}`);
  
  if (!originalUrl) {
    console.error(`No URL provided for ${label} audio`);
    alert(`Error: No audio URL available for ${label}`);
    setIsAudioLoading(false);
    return;
  }
  
  try {
    // Show the transcript
    setShowTranscript(true);
    
    // Display loading state
    setIsAudioLoading(true);
    setCurrentAudioId(audioType === 'brief' ? 'brief' : audioType === 'detailed' ? 'detailed' : 'in-depth');
    
    // Get the appropriate URL (will be cache URL if offline/downloaded)
    const url = await getAudioUrl(poiId, audioType, originalUrl, tour.id);
    setActiveAudioUrl(url);
    
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
    }
    
    // Create a new audio element
    const audio = new Audio();
    
    // Set up event handlers
    // ... (rest of your existing event handlers)
    
    // Set the source to our determined URL (stable cache key or original)
    audio.src = url;
    audio.load();
    
    // Store the audio element
    setAudioElement(audio);
    
  } catch (error) {
    console.error(`Error creating Audio object for ${label}:`, error);
    setIsAudioLoading(false);
    setIsPlaying(false);
    alert(`Error setting up audio playback: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}, [audioElement, isAudioLoading, tour?.id]);

// Update play button clicks:
<button 
  onClick={async () => {
    const audioUrl = audioData[currentStop.poi.id]?.audioFiles?.coreAudioUrl;
    if (!audioUrl) {
      alert("No brief audio available. Try regenerating the audio guides.");
      return;
    }
    await playAudio(audioUrl, "Brief Overview", currentStop.poi.id, 'brief');
  }}
>
  Brief Overview
</button>
```

## Implementation Timeline

1. **Core Infrastructure (4-6 hours)**:
   - Implement `offlineTourService.ts` with IndexedDB handling
   - Update service worker to handle stable cache keys
   - Add download/delete tour functionality

2. **UI Components (2-3 hours)**:
   - Create download button component
   - Update audio player to use stable cache keys
   - Add status indicators for offline content

3. **Testing and Refinement (3-4 hours)**:
   - Test on multiple browsers (Chrome, Safari, Firefox)
   - Test with network off/on transitions
   - Test with multiple tours and large audio files

## Benefits of This Approach

1. **Simplicity**: Using POI ID + audio type as stable cache keys is straightforward
2. **Reliability**: Works even when presigned URLs change or expire
3. **Performance**: Cached content loads faster than streaming
4. **Cross-browser compatibility**: Works on all modern browsers including Safari on iOS
5. **User-friendly**: Clear download/offline indicators

## Next Steps

1. Implement the `offlineTourService.ts` first
2. Enhance the service worker to handle stable cache keys
3. Add the download button to the tour page
4. Update the audio player to work with both online and offline content
5. Test thoroughly across devices and network conditions 