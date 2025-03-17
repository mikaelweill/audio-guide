'use client';

import { Tour, DownloadedTour, CachedResource, AudioData } from '@/types/tours';

// Constants
const DB_NAME = 'offline-audio-guide';
const DB_VERSION = 1;
const TOUR_STORE = 'downloadedTours';
const RESOURCE_STORE = 'cachedResources';
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout for downloads

/**
 * Check if the app is running as a PWA
 */
export function isPwa(): boolean {
  // Only run this check on the client
  if (typeof window === 'undefined') return false;
  
  // Check for standalone mode (installed PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || (navigator as any).standalone === true; // iOS Safari

  return isStandalone;
}

/**
 * Create a stable cache key for audio files
 */
export function createAudioCacheKey(poiId: string, audioType: 'brief' | 'detailed' | 'complete'): string {
  return `/offline-audio/${poiId}/${audioType}`;
}

/**
 * Create a stable cache key for images
 */
export function createImageCacheKey(url: string): string {
  // Extract the filename or a unique part of the URL
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    return `/offline-images/${filename}`;
  } catch (error) {
    // Fallback in case URL parsing fails
    const hash = Math.random().toString(36).substring(2, 15);
    return `/offline-images/fallback-${hash}`;
  }
}

/**
 * Initialize IndexedDB with retry logic
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Setup a timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('Database initialization timed out'));
    }, 5000);
    
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        clearTimeout(timeout);
        console.error('IndexedDB error:', event);
        reject(new Error('Failed to open database'));
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(TOUR_STORE)) {
          db.createObjectStore(TOUR_STORE, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(RESOURCE_STORE)) {
          db.createObjectStore(RESOURCE_STORE, { keyPath: 'cacheKey' });
        }
      };
      
      request.onsuccess = (event) => {
        clearTimeout(timeout);
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error setting up IndexedDB:', error);
      reject(error);
    }
  });
}

/**
 * Store a downloaded tour in IndexedDB
 */
async function storeTour(tour: DownloadedTour): Promise<void> {
  let db: IDBDatabase | null = null;
  
  try {
    db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db!.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);
      
      const request = store.put(tour);
      
      request.onerror = () => reject(new Error('Failed to store tour'));
      request.onsuccess = () => resolve();
      
      transaction.oncomplete = () => {
        if (db) db.close();
      };
      
      transaction.onerror = (event) => {
        console.error('Transaction error:', event);
        reject(new Error('Transaction failed'));
      };
      
      // Set a timeout to prevent hanging transactions
      setTimeout(() => {
        try {
          if (transaction.error) {
            reject(transaction.error);
          } else {
            reject(new Error('Store tour transaction timed out'));
          }
        } catch (e) {
          reject(new Error('Store tour timed out'));
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Error in storeTour:', error);
    if (db) db.close();
    throw error;
  }
}

/**
 * Store a cached resource in IndexedDB
 */
async function storeResource(resource: CachedResource): Promise<void> {
  let db: IDBDatabase | null = null;
  
  try {
    db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db!.transaction([RESOURCE_STORE], 'readwrite');
      const store = transaction.objectStore(RESOURCE_STORE);
      
      const request = store.put(resource);
      
      request.onerror = () => reject(new Error('Failed to store resource'));
      request.onsuccess = () => resolve();
      
      transaction.oncomplete = () => {
        if (db) db.close();
      };
      
      // Set a timeout to prevent hanging transactions
      setTimeout(() => {
        try {
          if (transaction.error) {
            reject(transaction.error);
          } else {
            reject(new Error('Store resource transaction timed out'));
          }
        } catch (e) {
          reject(new Error('Store resource timed out'));
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Error in storeResource:', error);
    if (db) db.close();
    throw error;
  }
}

/**
 * Retrieve a downloaded tour from IndexedDB
 */
async function getTour(tourId: string): Promise<DownloadedTour | null> {
  let db: IDBDatabase | null = null;
  
  try {
    db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db!.transaction([TOUR_STORE], 'readonly');
      const store = transaction.objectStore(TOUR_STORE);
      
      const request = store.get(tourId);
      
      request.onerror = () => reject(new Error('Failed to retrieve tour'));
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      transaction.oncomplete = () => {
        if (db) db.close();
      };
      
      // Set a timeout to prevent hanging transactions
      setTimeout(() => {
        try {
          if (transaction.error) {
            reject(transaction.error);
          } else {
            reject(new Error('Get tour transaction timed out'));
          }
        } catch (e) {
          reject(new Error('Get tour timed out'));
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Error in getTour:', error);
    if (db) db.close();
    throw error;
  }
}

/**
 * Check if a tour is downloaded
 */
export async function checkIfTourIsDownloaded(tourId: string): Promise<boolean> {
  try {
    const tour = await getTour(tourId);
    return !!tour;
  } catch (error) {
    console.error('Error checking if tour is downloaded:', error);
    return false;
  }
}

/**
 * Get a list of all downloaded tours
 */
export async function getAllDownloadedTours(): Promise<DownloadedTour[]> {
  let db: IDBDatabase | null = null;
  
  try {
    db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db!.transaction([TOUR_STORE], 'readonly');
      const store = transaction.objectStore(TOUR_STORE);
      
      const request = store.getAll();
      
      request.onerror = () => reject(new Error('Failed to get downloaded tours'));
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      transaction.oncomplete = () => {
        if (db) db.close();
      };
      
      // Set a timeout to prevent hanging transactions
      setTimeout(() => {
        try {
          if (transaction.error) {
            reject(transaction.error);
          } else {
            reject(new Error('Get all tours transaction timed out'));
          }
        } catch (e) {
          reject(new Error('Get all tours timed out'));
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Error in getAllDownloadedTours:', error);
    if (db) db.close();
    throw error;
  }
}

/**
 * A registry of all current downloads to monitor for errors
 */
interface DownloadMonitor {
  [tourId: string]: {
    startTime: number;
    lastProgressTime: number;
    progress: number;
    abortController: AbortController;
    timeoutId?: number;
  }
}

// Global download monitor
const activeDownloads: DownloadMonitor = {};

/**
 * Register a download with the monitor
 */
function registerDownload(tourId: string, abortController: AbortController): void {
  const now = Date.now();
  
  // Cleanup any existing download for this tour
  if (activeDownloads[tourId]) {
    clearTimeout(activeDownloads[tourId].timeoutId);
    try {
      activeDownloads[tourId].abortController.abort();
    } catch (e) {
      console.error('Error aborting previous download:', e);
    }
  }
  
  // Register new download
  activeDownloads[tourId] = {
    startTime: now,
    lastProgressTime: now,
    progress: 0,
    abortController,
  };
  
  // Set timeout to check for stalled downloads
  const timeoutId = window.setTimeout(() => checkDownloadHealth(tourId), 10000);
  activeDownloads[tourId].timeoutId = timeoutId as unknown as number;
}

/**
 * Update download progress in the monitor
 */
function updateDownloadProgress(tourId: string, progress: number): void {
  if (activeDownloads[tourId]) {
    activeDownloads[tourId].lastProgressTime = Date.now();
    activeDownloads[tourId].progress = progress;
  }
}

/**
 * Check download health and abort if stuck
 */
function checkDownloadHealth(tourId: string): void {
  const download = activeDownloads[tourId];
  
  if (!download) return;
  
  const now = Date.now();
  const lastProgressDelta = now - download.lastProgressTime;
  const totalTime = now - download.startTime;
  
  // If no progress for 30 seconds, or total time > 5 minutes, abort download
  if (lastProgressDelta > 30000 || totalTime > 300000) {
    console.error(`Download for tour ${tourId} appears to be stuck. Aborting.`);
    download.abortController.abort();
    
    // Remove from active downloads
    clearTimeout(download.timeoutId);
    delete activeDownloads[tourId];
    
    // Try to clean up any partial download
    try {
      deleteTour(tourId, true).catch(e => console.error('Error cleaning up stuck download:', e));
    } catch (e) {
      console.error('Error cleaning up stuck download:', e);
    }
  } else {
    // Schedule next check
    const timeoutId = window.setTimeout(() => checkDownloadHealth(tourId), 10000);
    download.timeoutId = timeoutId as unknown as number;
  }
}

/**
 * Complete download and remove from monitor
 */
function completeDownload(tourId: string): void {
  if (activeDownloads[tourId]) {
    clearTimeout(activeDownloads[tourId].timeoutId);
    delete activeDownloads[tourId];
  }
}

/**
 * Download a tour and its resources for offline use
 */
export async function downloadTour(
  tour: Tour, 
  audioData: Record<string, AudioData>,
  progressCallback?: (progress: number, status?: string) => void
): Promise<void> {
  // Create an AbortController to be able to cancel the download
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Register with download monitor
  registerDownload(tour.id, controller);
  
  // Set a timeout to abort if the download takes too long
  const timeoutId = setTimeout(() => {
    controller.abort();
    throw new Error('Download timed out');
  }, DOWNLOAD_TIMEOUT);
  
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      throw new Error('Service worker not available');
    }
    
    // Create arrays to store cached resource keys
    const audioResources: string[] = [];
    const imageResources: string[] = [];
    
    // Calculate total items to download
    const poiCount = tour.tourPois.length;
    const audioCount = poiCount * 3; // brief, detailed, complete for each POI
    const imageCount = tour.tourPois.reduce((count, poi) => {
      return count + (poi.poi.photo_references?.length || 0);
    }, 0);
    
    const totalItems = audioCount + imageCount || 1; // Ensure at least 1 to avoid division by zero
    let completedItems = 0;
    
    // Update progress via monitor
    const updateProgress = (status?: string) => {
      completedItems++;
      const progress = Math.min(100, Math.round((completedItems / totalItems) * 100));
      
      // Update the download monitor
      updateDownloadProgress(tour.id, progress);
      
      if (progressCallback) {
        progressCallback(progress, status);
      }
    };
    
    // Download and cache each audio file
    for (const tourPoi of tour.tourPois) {
      if (signal.aborted) {
        throw new Error('Download aborted');
      }
      
      const poiId = tourPoi.poi.id;
      
      if (!audioData[poiId]) {
        console.warn(`No audio data found for POI ${poiId}`);
        // Update progress even if there's no data to maintain progress calculation
        updateProgress(`Skipping audio for ${tourPoi.poi.name} (no data)`);
        updateProgress();
        updateProgress();
        continue;
      }
      
      // Cache brief audio
      if (audioData[poiId].brief) {
        try {
          const briefCacheKey = createAudioCacheKey(poiId, 'brief');
          await cacheResource(audioData[poiId].brief, briefCacheKey, 'audio/mpeg', signal);
          audioResources.push(briefCacheKey);
          updateProgress(`Caching audio for ${tourPoi.poi.name} (brief)`);
        } catch (error) {
          console.error(`Failed to cache brief audio for POI ${poiId}:`, error);
          updateProgress(`Error caching brief audio for ${tourPoi.poi.name}`);
        }
      } else {
        updateProgress();
      }
      
      // Cache detailed audio
      if (audioData[poiId].detailed) {
        try {
          const detailedCacheKey = createAudioCacheKey(poiId, 'detailed');
          await cacheResource(audioData[poiId].detailed, detailedCacheKey, 'audio/mpeg', signal);
          audioResources.push(detailedCacheKey);
          updateProgress(`Caching audio for ${tourPoi.poi.name} (detailed)`);
        } catch (error) {
          console.error(`Failed to cache detailed audio for POI ${poiId}:`, error);
          updateProgress(`Error caching detailed audio for ${tourPoi.poi.name}`);
        }
      } else {
        updateProgress();
      }
      
      // Cache complete audio
      if (audioData[poiId].complete) {
        try {
          const completeCacheKey = createAudioCacheKey(poiId, 'complete');
          await cacheResource(audioData[poiId].complete, completeCacheKey, 'audio/mpeg', signal);
          audioResources.push(completeCacheKey);
          updateProgress(`Caching audio for ${tourPoi.poi.name} (complete)`);
        } catch (error) {
          console.error(`Failed to cache complete audio for POI ${poiId}:`, error);
          updateProgress(`Error caching complete audio for ${tourPoi.poi.name}`);
        }
      } else {
        updateProgress();
      }
      
      // Cache POI images if available
      if (tourPoi.poi.photo_references && tourPoi.poi.photo_references.length > 0) {
        for (const photoRef of tourPoi.poi.photo_references) {
          if (signal.aborted) {
            throw new Error('Download aborted');
          }
          
          // Create a URL for the photo reference
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          const imageCacheKey = createImageCacheKey(photoUrl);
          
          try {
            await cacheResource(photoUrl, imageCacheKey, 'image/jpeg', signal);
            imageResources.push(imageCacheKey);
          } catch (error) {
            console.error(`Failed to cache image for POI ${poiId}:`, error);
          }
          
          updateProgress(`Caching images for ${tourPoi.poi.name}`);
        }
      }
    }
    
    // Create and store the downloaded tour record
    const downloadedTour: DownloadedTour = {
      id: tour.id,
      tour,
      downloadedAt: Date.now(),
      audioResources,
      imageResources
    };
    
    await storeTour(downloadedTour);
    
    if (progressCallback) {
      progressCallback(100, 'Download complete');
    }
    
    // Mark download as completed in the monitor
    completeDownload(tour.id);
    
    // Clear the timeout
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Remove from active downloads
    completeDownload(tour.id);
    
    console.error('Error downloading tour:', error);
    
    // Try to clean up any partially downloaded resources
    try {
      await deleteTour(tour.id, true); // Silent cleanup
    } catch (cleanupError) {
      console.error('Failed to clean up after failed download:', cleanupError);
    }
    
    throw error;
  }
}

/**
 * Cache a resource using the service worker with retry logic
 */
async function cacheResource(
  url: string, 
  cacheKey: string, 
  contentType: string,
  signal: AbortSignal
): Promise<void> {
  const MAX_RETRIES = 2;
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      // Check if the signal is aborted before proceeding
      if (signal.aborted) {
        throw new Error('Resource caching aborted');
      }
      
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        // Check if the resource is already cached
        const cache = await caches.open('audio-guide-offline');
        const response = await cache.match(cacheKey);
        
        if (!response) {
          // Resource is not yet cached, request the service worker to cache it
          const fetchOptions: RequestInit = { 
            mode: 'cors', 
            credentials: 'same-origin',
            signal
          };
          
          // Set a timeout for the fetch operation
          const fetchWithTimeout = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            try {
              return await fetch(url, { 
                ...fetchOptions, 
                signal: controller.signal 
              });
            } finally {
              clearTimeout(timeoutId);
            }
          };
          
          // Fetch the original URL
          const originalResponse = await fetchWithTimeout();
          
          if (!originalResponse.ok) {
            throw new Error(`Failed to fetch resource: ${originalResponse.status} ${originalResponse.statusText}`);
          }
          
          // Create a new request with our cache key URL
          const cacheRequest = new Request(cacheKey);
          
          // Create a new response with the same body but a different URL
          const newResponse = new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: originalResponse.headers
          });
          
          // Store in cache with our stable key
          await cache.put(cacheRequest, newResponse);
          
          // Store metadata in IndexedDB
          const resource: CachedResource = {
            url,
            cacheKey,
            contentType,
            size: 0, // We can't easily get the size here
            timestamp: Date.now()
          };
          
          await storeResource(resource);
        }
        
        return; // Success - exit the retry loop
      } else {
        throw new Error('Service worker not available');
      }
    } catch (error) {
      retries++;
      console.error(`Error caching resource ${url} (attempt ${retries}/${MAX_RETRIES + 1}):`, error);
      
      if (signal.aborted || retries > MAX_RETRIES) {
        throw error;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}

/**
 * Delete a downloaded tour
 */
export async function deleteTour(tourId: string, silent: boolean = false): Promise<void> {
  try {
    // Get the tour first to access its cached resources
    const tour = await getTour(tourId);
    
    if (!tour) {
      if (!silent) {
        console.warn(`Tour ${tourId} not found in offline storage`);
      }
      return;
    }
    
    // Delete the tour from IndexedDB
    const db = await initDB();
    
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);
      
      const request = store.delete(tourId);
      
      request.onerror = () => reject(new Error('Failed to delete tour'));
      request.onsuccess = () => resolve();
      
      transaction.oncomplete = () => db.close();
      
      // Set a timeout to prevent hanging transactions
      setTimeout(() => {
        try {
          if (transaction.error) {
            reject(transaction.error);
          } else {
            reject(new Error('Delete tour transaction timed out'));
          }
        } catch (e) {
          reject(new Error('Delete tour timed out'));
        }
      }, 5000);
    });
    
    // Remove cached resources if no other tours are using them
    const cache = await caches.open('audio-guide-offline');
    
    // Get all other tours to check for shared resources
    const allTours = await getAllDownloadedTours();
    const otherTours = allTours.filter(t => t.id !== tourId);
    
    // Create sets of all resources used by other tours
    const otherAudioResources = new Set<string>();
    const otherImageResources = new Set<string>();
    
    for (const otherTour of otherTours) {
      otherTour.audioResources.forEach(key => otherAudioResources.add(key));
      otherTour.imageResources.forEach(key => otherImageResources.add(key));
    }
    
    // Delete audio resources that are not used by other tours
    for (const audioKey of tour.audioResources) {
      if (!otherAudioResources.has(audioKey)) {
        try {
          await cache.delete(audioKey);
          
          // Also delete from resource store
          const db = await initDB();
          const transaction = db.transaction([RESOURCE_STORE], 'readwrite');
          const store = transaction.objectStore(RESOURCE_STORE);
          await store.delete(audioKey);
          db.close();
        } catch (error) {
          console.error(`Error deleting audio resource ${audioKey}:`, error);
        }
      }
    }
    
    // Delete image resources that are not used by other tours
    for (const imageKey of tour.imageResources) {
      if (!otherImageResources.has(imageKey)) {
        try {
          await cache.delete(imageKey);
          
          // Also delete from resource store
          const db = await initDB();
          const transaction = db.transaction([RESOURCE_STORE], 'readwrite');
          const store = transaction.objectStore(RESOURCE_STORE);
          await store.delete(imageKey);
          db.close();
        } catch (error) {
          console.error(`Error deleting image resource ${imageKey}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting tour:', error);
    throw error;
  }
}

/**
 * Get the URL for an audio file, whether online or offline
 */
export async function getAudioUrl(poiId: string, audioType: 'brief' | 'detailed' | 'complete', onlineUrl: string): Promise<string> {
  try {
    // First, check if we're online
    if (navigator.onLine) {
      return onlineUrl;
    }
    
    // We're offline, try to get from cache
    const cacheKey = createAudioCacheKey(poiId, audioType);
    const cache = await caches.open('audio-guide-offline');
    const response = await cache.match(cacheKey);
    
    if (response) {
      return cacheKey;
    }
    
    // Not found in cache
    throw new Error('Audio not available offline');
  } catch (error) {
    console.error('Error getting audio URL:', error);
    throw error;
  }
} 