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
export async function getTour(tourId: string): Promise<DownloadedTour | null> {
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
 * Check if a specific resource is available in any cache or IndexedDB
 */
export async function resourceIsAvailable(cacheKey: string): Promise<boolean> {
  // First try the Cache API
  if ('caches' in window) {
    try {
      // Try production cache
      const productionCache = await caches.open('audio-guide-offline');
      const productionResponse = await productionCache.match(cacheKey);
      
      if (productionResponse) {
        return true;
      }
      
      // Try development cache
      const devCache = await caches.open('audio-guide-localhost-cache');
      const devResponse = await devCache.match(cacheKey);
      
      if (devResponse) {
        return true;
      }
    } catch (error) {
      console.error(`Cache check error for ${cacheKey}:`, error);
      // Continue to check IndexedDB
    }
  }
  
  // Try IndexedDB as fallback
  try {
    const blob = await getResourceFromIndexedDB(cacheKey);
    return !!blob;
  } catch (error) {
    console.error(`IndexedDB check error for ${cacheKey}:`, error);
    return false;
  }
}

/**
 * Validate that all tour resources are available
 */
export async function validateTourResources(tourId: string): Promise<{
  valid: boolean;
  total: number;
  available: number;
  missingResources: string[];
}> {
  try {
    // Get tour data
    const tour = await getTour(tourId);
    if (!tour) {
      return { valid: false, total: 0, available: 0, missingResources: [] };
    }
    
    // Collect all resources
    const allResources = [...(tour.audioResources || []), ...(tour.imageResources || [])];
    const missingResources: string[] = [];
    let availableCount = 0;
    
    // Check each resource
    for (const cacheKey of allResources) {
      const isAvailable = await resourceIsAvailable(cacheKey);
      
      if (isAvailable) {
        availableCount++;
      } else {
        missingResources.push(cacheKey);
      }
    }
    
    return {
      valid: missingResources.length === 0,
      total: allResources.length,
      available: availableCount,
      missingResources
    };
  } catch (error) {
    console.error(`Error validating tour resources for ${tourId}:`, error);
    return { valid: false, total: 0, available: 0, missingResources: [] };
  }
}

/**
 * Enhanced check if a tour is downloaded AND has all resources available
 */
export async function verifyTourForOffline(tourId: string): Promise<boolean> {
  try {
    // First check if tour exists in database
    const tour = await getTour(tourId);
    if (!tour) return false;
    
    // Now validate that all resources are actually available
    const validation = await validateTourResources(tourId);
    return validation.valid;
  } catch (error) {
    console.error('Error verifying tour for offline:', error);
    return false;
  }
}

/**
 * Download a tour and its resources for offline use
 * LOCALHOST VERSION: No service worker dependency at all
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
    progressCallback?.(0, 'Initializing direct download...');
    
    // Create arrays to store cached resource keys
    const audioResources: string[] = [];
    const imageResources: string[] = [];
    
    // Create array of resources to cache
    const resourcesToCache: { url: string; cacheKey: string }[] = [];
    
    // Add the tour API data
    resourcesToCache.push({
      url: `/api/tours/${tour.id}`,
      cacheKey: `/api/tours/${tour.id}`
    });
    
    // Add all POI data 
    for (const tourPoi of tour.tourPois) {
      const poi = tourPoi.poi;
      const poiId = poi.id;
      const poiAudio = audioData[poiId];
      
      // Add thumbnail image if available
      if (poi.thumbnail_url) {
        const imageCacheKey = createImageCacheKey(poi.thumbnail_url);
        resourcesToCache.push({
          url: poi.thumbnail_url,
          cacheKey: imageCacheKey
        });
        imageResources.push(imageCacheKey);
      }
      
      // Add audio files with stable cache keys
      if (poiAudio?.brief) {
        const audioCacheKey = createAudioCacheKey(poiId, 'brief');
        resourcesToCache.push({
          url: poiAudio.brief,
          cacheKey: audioCacheKey
        });
        audioResources.push(audioCacheKey);
      }
      
      if (poiAudio?.detailed) {
        const audioCacheKey = createAudioCacheKey(poiId, 'detailed');
        resourcesToCache.push({
          url: poiAudio.detailed,
          cacheKey: audioCacheKey
        });
        audioResources.push(audioCacheKey);
      }
      
      if (poiAudio?.complete) {
        const audioCacheKey = createAudioCacheKey(poiId, 'complete');
        resourcesToCache.push({
          url: poiAudio.complete,
          cacheKey: audioCacheKey
        });
        audioResources.push(audioCacheKey);
      }
    }
    
    if (resourcesToCache.length === 0) {
      throw new Error('No resources found to cache for this tour');
    }
    
    progressCallback?.(5, `Preparing to download ${resourcesToCache.length} files...`);
    
    // Track successful resources
    const verifiedResources: { audioResources: string[], imageResources: string[] } = {
      audioResources: [],
      imageResources: []
    };
    
    // LOCALHOST VERSION: Try different storage approaches for maximum compatibility
    try {
      // First try the combined approach
      console.log("🔧 DEBUG: Trying combined cache approach first");
      await localhostCacheResources(resourcesToCache, progressCallback, signal, verifiedResources);
    } catch (combinedError) {
      console.error("🔧 DEBUG: Combined approach failed:", combinedError);
      
      // Reset verified resources
      verifiedResources.audioResources = [];
      verifiedResources.imageResources = [];
      
      // If that fails, try pure IndexedDB approach
      console.log("🔧 DEBUG: Falling back to pure IndexedDB approach");
      try {
        await indexedDBOnlyResources(resourcesToCache, progressCallback, signal, verifiedResources);
      } catch (indexedDBError: any) {
        console.error("🔧 DEBUG: IndexedDB approach also failed:", indexedDBError);
        throw new Error("Failed to cache resources: " + (indexedDBError.message || 'Unknown error'));
      }
    }
    
    // Validate number of resources cached
    const totalExpectedResources = audioResources.length + imageResources.length;
    const totalVerifiedResources = verifiedResources.audioResources.length + verifiedResources.imageResources.length;
    
    // Only mark download as complete if we have ALL resources
    if (totalVerifiedResources < totalExpectedResources) {
      progressCallback?.(95, `Warning: Only ${totalVerifiedResources}/${totalExpectedResources} resources were cached`);
      throw new Error(`Incomplete download: Only ${totalVerifiedResources}/${totalExpectedResources} resources cached successfully`);
    }
    
    // Store downloaded tour in IndexedDB
    const downloadedTour: DownloadedTour = {
      id: tour.id,
      tour,
      downloadedAt: Date.now(),
      audioResources: verifiedResources.audioResources,
      imageResources: verifiedResources.imageResources
    };
    
    // Store tour data in IndexedDB first before completing
    await storeTour(downloadedTour);
    
    // Update progress
    progressCallback?.(100, 'Tour successfully downloaded');
    
    // Complete download in monitor
    completeDownload(tour.id);
    
    // Clear timeout
    clearTimeout(timeoutId);
  } catch (error) {
    // Clean up failed download
    console.error('Error downloading tour:', error);
    
    if (!signal.aborted) {
      // Only try to clean up if the download wasn't deliberately aborted
      try {
        // Try to delete any partial data
        await deleteTour(tour.id, true).catch(() => {});
      } catch (e) {
        console.error('Error cleaning up failed download:', e);
      }
    }
    
    // Complete download in monitor
    completeDownload(tour.id);
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    // Re-throw the error
    throw error;
  }
}

/**
 * LOCALHOST VERSION: Cache resources as reliably as possible
 * This avoids all service worker dependencies for maximum dev compatibility
 */
async function localhostCacheResources(
  resources: { url: string; cacheKey: string }[],
  progressCallback?: (progress: number, status?: string) => void,
  signal?: AbortSignal,
  verifiedResources: { audioResources: string[], imageResources: string[] } = { audioResources: [], imageResources: [] }
): Promise<void> {
  try {
    console.log('🔧 CACHE DEBUG: Starting cache operation with', resources.length, 'resources');
    
    // Track progress
    let completed = 0;
    const total = resources.length;
    
    // Process resources one at a time to avoid overloading
    for (const { url, cacheKey } of resources) {
      // Check if download was aborted
      if (signal?.aborted) {
        console.log('🔧 CACHE DEBUG: Download aborted');
        throw new Error('Download aborted');
      }
      
      try {
        console.log(`🔧 CACHE DEBUG: Processing resource ${completed+1}/${total}: ${url} → ${cacheKey}`);
        
        // Use a direct fetch with appropriate options for localhost
        const fetchOptions: RequestInit = {
          method: 'GET',
          cache: 'no-store', // Force fresh fetch
          credentials: 'same-origin',
          signal: signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        };
        
        // Fetch the resource
        console.log(`🔧 CACHE DEBUG: Fetching ${url}`);
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
          console.warn(`🔧 CACHE DEBUG: Failed to fetch ${url}, status: ${response.status}`);
          continue;
        }
        
        console.log(`🔧 CACHE DEBUG: Fetch successful, status: ${response.status}`);
        
        // Handle audio and image resources - store as binary data in IndexedDB
        if (cacheKey.includes('/offline-audio/') || cacheKey.includes('/offline-images/')) {
          console.log(`🔧 CACHE DEBUG: Storing binary data directly in IndexedDB for ${cacheKey}`);
          
          // Convert to blob and store
          const blob = await response.clone().blob();
          await storeResourceBlob(cacheKey, blob);
          
          // Verify the resource was actually stored in IndexedDB
          const verifyBlob = await getResourceFromIndexedDB(cacheKey);
          if (!verifyBlob) {
            console.error(`🔧 CACHE DEBUG: Verification failed for ${cacheKey} in IndexedDB`);
            continue;
          }
          
          console.log(`🔧 CACHE DEBUG: Successfully stored and verified in IndexedDB: ${cacheKey}`);
        } 
        // For API resources like tour data, use both Cache API and IndexedDB
        else {
          try {
            // Try Cache API for non-binary data (API responses, etc)
            if ('caches' in window) {
              // Cache with the stable key
              const cache = await caches.open('audio-guide-localhost-cache');
              const request = new Request(cacheKey);
              console.log(`🔧 CACHE DEBUG: Caching API data at key ${cacheKey}`);
              await cache.put(request, response.clone());
              
              // Verify the resource was actually cached
              const verifyResponse = await cache.match(request);
              if (!verifyResponse) {
                console.error(`🔧 CACHE DEBUG: Cache API verification failed for ${cacheKey}`);
                // Don't exit early, we'll try IndexedDB as fallback
              } else {
                console.log(`🔧 CACHE DEBUG: Cache API verification successful for ${cacheKey}`);
              }
            }
          } catch (cacheError) {
            console.warn('🔧 CACHE DEBUG: Cache API failed, falling back to IndexedDB for API data:', cacheError);
          }
          
          // Always store in IndexedDB as backup/fallback for API data too
          try {
            const jsonData = await response.clone().json();
            await storeJsonInIndexedDB(cacheKey, jsonData);
            console.log(`🔧 CACHE DEBUG: Successfully stored API data in IndexedDB for ${cacheKey}`);
          } catch (jsonError) {
            console.error(`🔧 CACHE DEBUG: Failed to store API data in IndexedDB for ${cacheKey}:`, jsonError);
            // If we couldn't store as JSON, try as blob
            try {
              const blob = await response.clone().blob();
              await storeResourceBlob(cacheKey, blob);
              console.log(`🔧 CACHE DEBUG: Stored API data as blob instead for ${cacheKey}`);
            } catch (blobError) {
              console.error(`🔧 CACHE DEBUG: Failed to store API data as blob for ${cacheKey}:`, blobError);
              continue; // Skip this resource
            }
          }
        }
        
        // Update progress
        completed++;
        const progress = Math.min(95, Math.round((completed / total) * 95));
        
        console.log(`🔧 CACHE DEBUG: Progress ${completed}/${total} (${progress}%)`);
        progressCallback?.(progress, `Downloaded ${completed}/${total} files...`);
        updateDownloadProgress(resources[0].url.split('/').pop() || 'unknown', progress);
        
        // Add to verified resources lists
        if (cacheKey.includes('/offline-audio/')) {
          verifiedResources.audioResources.push(cacheKey);
        } else if (cacheKey.includes('/offline-images/')) {
          verifiedResources.imageResources.push(cacheKey);
        } else if (cacheKey.startsWith('/api/tours/')) {
          // API data is tracked separately
        }
      } catch (resourceError) {
        console.error(`🔧 CACHE DEBUG: Error processing ${url}:`, resourceError);
        // Continue with next resource
      }
    }
    
    console.log('🔧 CACHE DEBUG: All resources processed, finalizing');
    progressCallback?.(95, 'Finalizing download...');
  } catch (error) {
    console.error('🔧 CACHE DEBUG: Fatal error in caching:', error);
    throw error;
  }
}

/**
 * Store JSON data in IndexedDB
 */
async function storeJsonInIndexedDB(key: string, data: any): Promise<void> {
  const db = await initDB();
  
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction([RESOURCE_STORE], 'readwrite');
      const store = transaction.objectStore(RESOURCE_STORE);
      
      const resource = {
        cacheKey: key,
        blob: new Blob([JSON.stringify(data)], { type: 'application/json' }),
        timestamp: Date.now(),
        isJson: true
      };
      
      const request = store.put(resource);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Failed to store JSON'));
      
      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Store a resource blob in IndexedDB as backup
 */
async function storeResourceBlob(key: string, blob: Blob): Promise<void> {
  const db = await initDB();
  
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction([RESOURCE_STORE], 'readwrite');
      const store = transaction.objectStore(RESOURCE_STORE);
      
      const resource = {
        cacheKey: key,
        blob,
        timestamp: Date.now()
      };
      
      const request = store.put(resource);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Failed to store blob'));
      
      transaction.oncomplete = () => db.close();
    } catch (error) {
      reject(error);
    }
  });
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
    // If we're online, use the provided URL
    if (navigator.onLine) {
      console.log(`🔊 AUDIO DEBUG: Online mode, using presigned URL`);
      return onlineUrl;
    }
    
    console.log(`🔊 AUDIO DEBUG: Getting offline audio for ${poiId}/${audioType}`);
    
    // We're offline, create the stable cache key
    const cacheKey = createAudioCacheKey(poiId, audioType);
    
    // Try to get the audio blob directly from IndexedDB
    console.log(`🔊 AUDIO DEBUG: Trying IndexedDB for ${cacheKey}`);
    const blob = await getResourceFromIndexedDB(cacheKey);
    
    if (blob) {
      console.log(`🔊 AUDIO DEBUG: Found in IndexedDB: ${cacheKey}`);
      
      // Create a blob URL for the resource
      const blobUrl = URL.createObjectURL(blob);
      console.log(`🔊 AUDIO DEBUG: Created blob URL: ${blobUrl} for ${cacheKey}`);
      
      // Store the mapping of cache key to blob URL for cleanup later
      if (typeof window !== 'undefined') {
        if (!window._blobUrlMappings) {
          window._blobUrlMappings = {};
        }
        window._blobUrlMappings[cacheKey] = blobUrl;
      }
      
      return blobUrl;
    }
    
    // If not found in IndexedDB, try standard caches as fallback
    try {
      if ('caches' in window) {
        console.log(`🔊 AUDIO DEBUG: Trying Cache API as fallback for ${cacheKey}`);
        
        // Try the main cache
        const cache = await caches.open('audio-guide-offline');
        const response = await cache.match(cacheKey);
        
        if (response) {
          console.log(`🔊 AUDIO DEBUG: Found in Cache API: ${cacheKey}`);
          return cacheKey; // Return the cache key as URL
        }
        
        // Also try localhost cache
        const localhostCache = await caches.open('audio-guide-localhost-cache');
        const localhostResponse = await localhostCache.match(cacheKey);
        
        if (localhostResponse) {
          console.log(`🔊 AUDIO DEBUG: Found in localhost Cache API: ${cacheKey}`);
          return cacheKey;
        }
      }
    } catch (cacheError) {
      console.error(`🔊 AUDIO DEBUG: Cache API error:`, cacheError);
    }
    
    // Not found anywhere
    console.error(`🔊 AUDIO DEBUG: Audio not found anywhere: ${cacheKey}`);
    throw new Error('Audio not available offline');
  } catch (error) {
    console.error('Error getting audio URL:', error);
    throw error;
  }
}

/**
 * Pure IndexedDB implementation for storing resources
 * Use when Cache API is problematic on localhost
 */
async function indexedDBOnlyResources(
  resources: { url: string; cacheKey: string }[],
  progressCallback?: (progress: number, status?: string) => void,
  signal?: AbortSignal,
  verifiedResources: { audioResources: string[], imageResources: string[] } = { audioResources: [], imageResources: [] }
): Promise<void> {
  console.log('🔧 INDEXEDDB DEBUG: Starting pure IndexedDB storage with', resources.length, 'resources');
  
  // Track progress
  let completed = 0;
  const total = resources.length;
  
  // Process resources one at a time
  for (const { url, cacheKey } of resources) {
    // Check if download was aborted
    if (signal?.aborted) {
      console.log('🔧 INDEXEDDB DEBUG: Download aborted');
      throw new Error('Download aborted');
    }
    
    try {
      console.log(`🔧 INDEXEDDB DEBUG: Processing resource ${completed+1}/${total}: ${url}`);
      
      // Fetch the resource with fetch options optimized for localhost
      const fetchOptions: RequestInit = {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };
      
      // Fetch the resource
      console.log(`🔧 INDEXEDDB DEBUG: Fetching ${url}`);
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        console.warn(`🔧 INDEXEDDB DEBUG: Failed to fetch ${url}, status: ${response.status}`);
        continue;
      }
      
      // Clone response and convert to blob
      console.log(`🔧 INDEXEDDB DEBUG: Converting response to blob for ${cacheKey}`);
      const blob = await response.clone().blob();
      
      // Store directly in IndexedDB
      console.log(`🔧 INDEXEDDB DEBUG: Storing blob in IndexedDB for ${cacheKey}`);
      await storeResourceBlob(cacheKey, blob);
      
      // Verify the resource was actually stored
      const verifyBlob = await getResourceFromIndexedDB(cacheKey);
      if (!verifyBlob) {
        console.error(`🔧 INDEXEDDB DEBUG: Verification failed for ${cacheKey}`);
        continue;
      }
      
      console.log(`🔧 INDEXEDDB DEBUG: Successfully stored and verified in IndexedDB: ${cacheKey}`);
      
      // Update progress
      completed++;
      const progress = Math.min(95, Math.round((completed / total) * 95));
      
      console.log(`🔧 INDEXEDDB DEBUG: Progress ${completed}/${total} (${progress}%)`);
      progressCallback?.(progress, `Downloaded ${completed}/${total} files...`);
      updateDownloadProgress(resources[0].url.split('/').pop() || 'unknown', progress);
      
      // Add to verified resources lists
      if (cacheKey.includes('/offline-audio/')) {
        verifiedResources.audioResources.push(cacheKey);
      } else if (cacheKey.includes('/offline-images/')) {
        verifiedResources.imageResources.push(cacheKey);
      } else if (cacheKey.startsWith('/api/tours/')) {
        // API data is tracked separately
      }
    } catch (error) {
      console.error(`🔧 INDEXEDDB DEBUG: Error processing ${url}:`, error);
      // Continue with next resource
    }
  }
  
  console.log('🔧 INDEXEDDB DEBUG: All resources processed successfully using IndexedDB');
  progressCallback?.(95, 'Finalizing download...');
}

/**
 * Retrieve a resource from IndexedDB
 * For pure IndexedDB mode
 */
export async function getResourceFromIndexedDB(cacheKey: string): Promise<Blob | null> {
  let db: IDBDatabase | null = null;
  
  try {
    db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db!.transaction([RESOURCE_STORE], 'readonly');
      const store = transaction.objectStore(RESOURCE_STORE);
      
      const request = store.get(cacheKey);
      
      request.onerror = () => reject(new Error('Failed to get resource from IndexedDB'));
      request.onsuccess = () => {
        const resource = request.result;
        if (!resource) {
          resolve(null);
          return;
        }
        
        // Return the blob
        resolve(resource.blob);
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
            reject(new Error('Get resource transaction timed out'));
          }
        } catch (e) {
          reject(new Error('Get resource timed out'));
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Error in getResourceFromIndexedDB:', error);
    if (db) db.close();
    throw error;
  }
}

// Add global type for blob URL mappings
declare global {
  interface Window {
    _blobUrlMappings?: Record<string, string>;
    waitForServiceWorker?: (timeout?: number) => Promise<boolean>;
  }
} 