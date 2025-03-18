    // This service worker can be customized!
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing new service worker...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  // Define production URL for the PWA
  self.APP_URL = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://audio-guide-theta.vercel.app';
  
  console.log('[Service Worker] Running at:', self.APP_URL);
  
  event.waitUntil(
    caches.open('offline-v1').then((cache) => {
      console.log('[Service Worker] Caching app shell...');
      return cache.addAll([
        '/',
        '/offline.html',
        '/manifest.json',
        '/earth-globe-global-svgrepo-com.svg',
        '/js/network-check.js'
      ]);
    })
  );
});

// Create a separate cache for API responses
const apiCacheName = 'api-cache-v1';

// Cache expiration time (24 hours)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Workbox will populate this array via the manifest
self.__WB_MANIFEST;

// Helper to check if a cached response is expired
const isCacheExpired = (cachedResponse) => {
  if (!cachedResponse) return true;
  
  const cachedAt = cachedResponse.headers.get('sw-cache-timestamp');
  if (!cachedAt) return false; // If no timestamp, assume it doesn't expire
  
  const ageInMs = Date.now() - new Date(cachedAt).getTime();
  return ageInMs > CACHE_EXPIRATION;
};

// Helper to add timestamp to response before caching
const addTimestampToResponse = (response) => {
  const clonedResponse = response.clone();
  const headers = new Headers(clonedResponse.headers);
  headers.append('sw-cache-timestamp', new Date().toISOString());
  
  return clonedResponse.blob().then(body => {
    return new Response(body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers: headers
    });
  });
};

// Create a cache for offline tour content
const offlineToursCache = 'audio-guide-offline';

// Fetch handler with improved offline support
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip handling Supabase storage requests to avoid CORS issues
  if (url.hostname.includes('supabase.co')) {
    // Let the browser handle Supabase requests normally without service worker interference
    return; // Important: this exits the event handler without calling respondWith
  }
  
  // Properly check if request is for our app, including production URL
  const isAppRequest = url.hostname === self.location.hostname || 
                      url.hostname === 'localhost' || 
                      url.hostname === '127.0.0.1' ||
                      url.hostname === 'audio-guide-theta.vercel.app';
  
  // Skip handling external API requests that might have their own CORS requirements
  if (!isAppRequest) {
    return; // Let browser handle external requests
  }
  
  // Special handling for API health endpoint - always go to network
  if (url.pathname === '/api/health') {
    return;
  }
  
  // Handle API requests (cache then network strategy for /api/tours)
  if (url.pathname.startsWith('/api/tours') && event.request.method === 'GET') {
    console.log('[Service Worker] Handling /api/tours request:', url.pathname);
    
    event.respondWith(
      // Try network first and cache the response
      fetch(event.request.clone(), {
        credentials: 'include', // Ensure cookies are sent with the request
        cache: 'no-cache'       // Don't use browser's HTTP cache
      })
        .then(response => {
          // Only cache valid responses
          if (!response || response.status !== 200) {
            console.log('[Service Worker] Invalid response, not caching');
            return response;
          }
          
          // Add timestamp and cache the response
          return addTimestampToResponse(response.clone())
            .then(timestampedResponse => {
              console.log('[Service Worker] Caching API response for:', url.pathname);
              
              caches.open(apiCacheName).then(cache => {
                cache.put(event.request, timestampedResponse);
              });
              
              return response;
            });
        })
        .catch(error => {
          console.log('[Service Worker] Network request failed, trying cache:', error);
          
          // If network fails, try the cache
          return caches.match(event.request)
            .then(cachedResponse => {
              // Check for cached response and if it's not expired
              if (cachedResponse && !isCacheExpired(cachedResponse)) {
                console.log('[Service Worker] Returning cached API response for:', url.pathname);
                return cachedResponse;
              }
              
              console.log('[Service Worker] No cached response available or cache expired, returning fallback');
              
              // If no cached response or it's expired, show empty tours
              if (url.pathname === '/api/tours') {
                return new Response(JSON.stringify({ 
                  success: true,
                  tours: [],
                  message: 'Offline mode - no cached tours available',
                  pagination: { total: 0, page: 1, limit: 6, pages: 0 }
                }), {
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // For other API requests
              return new Response(JSON.stringify({ 
                success: false,
                message: 'You are offline and this data is not cached'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }
  
  // Only handle app-specific requests and ignore external resources
  if (url.hostname === self.location.hostname) {
    // Handle non-API requests (network first, then cache)
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              // Return cached response or offline page for navigation
              if (cachedResponse) {
                return cachedResponse;
              }
              
              if (event.request.mode === 'navigate') {
                return caches.match('/offline.html');
              }
              
              return null;
            });
        })
    );
  }
  
  // Check if this is one of our stable cache key URLs for offline audio
  const isOfflineAudio = url.pathname.startsWith('/offline-audio/');
  const isOfflineImage = url.pathname.startsWith('/offline-images/');
  
  if (isOfflineAudio || isOfflineImage) {
    console.log(`[SW] Handling offline resource request: ${url.pathname}`);
    
    event.respondWith(
      caches.open(offlineToursCache).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            console.log(`[SW] Found cached offline resource: ${url.pathname}`);
            return response;
          }
          
          console.error(`[SW] Offline resource not found in cache: ${url.pathname}`);
          return new Response('Resource not available offline', { 
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      }).catch(error => {
        console.error(`[SW] Error retrieving offline resource: ${error}`);
        return new Response('Error accessing offline resource', { status: 500 });
      })
    );
    return;
  }
});

// Clean up old caches and handle mobile reconnection
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new service worker...');
  
  // Take control immediately
  self.clients.claim();
  
  const cacheWhitelist = ['offline-v1', apiCacheName];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Clean expired cache entries
  event.waitUntil(
    caches.open(apiCacheName).then(cache => {
      return cache.keys().then(requests => {
        return Promise.all(
          requests.map(request => {
            return cache.match(request).then(response => {
              if (isCacheExpired(response)) {
                console.log('[Service Worker] Removing expired cache entry:', request.url);
                return cache.delete(request);
              }
            });
          })
        );
      });
    })
  );
});

// Add message event listener for caching tours
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_TOUR_RESOURCES') {
    const { tourId, resources } = event.data;
    
    console.log(`[SW] Received request to cache ${resources.length} resources for tour ${tourId}`);
    
    // Check if MessageChannel is being used correctly
    if (!event.ports || event.ports.length === 0) {
      console.error('[SW] No MessageChannel port provided in the message');
      return;
    }
    
    // Get the MessageChannel port to communicate back to the client
    const port = event.ports[0];
    
    // Send initial progress message
    port.postMessage({ 
      progress: 0, 
      status: `Starting download (0/${resources.length})` 
    });
    
    event.waitUntil(
      caches.open(offlineToursCache).then(async (cache) => {
        console.log(`[SW] Caching ${resources.length} resources for tour ${tourId}`);
        
        // Process resources sequentially to avoid overwhelming the network
        const results = [];
        let totalProcessed = 0;
        
        for (const { url, cacheKey } of resources) {
          try {
            // Fetch the resource from the network
            console.log(`[SW] Fetching resource: ${url}`);
            const response = await fetch(url, { cache: 'no-store' });
            
            if (!response || response.status !== 200) {
              throw new Error(`Failed to fetch ${url}, status: ${response?.status}`);
            }
            
            // Store with the stable cache key
            console.log(`[SW] Caching as: ${cacheKey}`);
            await cache.put(new Request(cacheKey), response.clone());
            
            results.push(true);
          } catch (error) {
            console.error(`[SW] Failed to cache ${url}:`, error);
            results.push(false);
          }
          
          totalProcessed++;
          
          // Send progress update every few resources or at the end
          if (totalProcessed % 3 === 0 || totalProcessed === resources.length) {
            const successCount = results.filter(Boolean).length;
            const progress = Math.round((totalProcessed / resources.length) * 100);
            
            port.postMessage({ 
              progress, 
              status: `Downloaded ${successCount}/${totalProcessed} (${progress}%)` 
            });
          }
        }
        
        const successCount = results.filter(Boolean).length;
        
        // Report back to the client
        if (successCount === resources.length) {
          port.postMessage({
            success: true,
            message: `Successfully cached all ${successCount} resources`,
            progress: 100
          });
        } else if (successCount > 0) {
          // Some resources succeeded
          port.postMessage({
            success: true, // Consider partial success still a success
            message: `Cached ${successCount}/${resources.length} resources`,
            progress: 100
          });
        } else {
          // All resources failed
          port.postMessage({
            success: false,
            error: `Failed to cache any resources`,
            progress: 0
          });
        }
      }).catch(error => {
        console.error('[SW] Caching error:', error);
        port.postMessage({ 
          error: error.message,
          success: false,
          progress: 0
        });
      })
    );
    return;
  }
  
  // Handle remove tour cache
  if (event.data.type === 'REMOVE_TOUR_RESOURCES') {
    const { tourId, resources } = event.data;
    
    console.log(`[SW] Removing cache for tour ${tourId}`);
    
    // Check if MessageChannel port was provided
    if (!event.ports || event.ports.length === 0) {
      console.error('[SW] No MessageChannel port provided for REMOVE_TOUR_RESOURCES');
      return;
    }
    
    const port = event.ports[0];
    
    event.waitUntil(
      caches.open(offlineToursCache).then(async (cache) => {
        // Delete all specified resources
        if (resources && resources.length > 0) {
          await Promise.all(resources.map(key => cache.delete(new Request(key))));
        }
        
        // Respond with success
        port.postMessage({ 
          success: true,
          message: `Removed cache for tour ${tourId}`
        });
      }).catch(error => {
        console.error('[SW] Remove cache error:', error);
        port.postMessage({ 
          success: false,
          error: error.message 
        });
      })
    );
    return;
  }
  
  // Ping to check if service worker is active
  if (event.data.type === 'PING') {
    console.log('[SW] Received ping from client');
    
    if (event.ports && event.ports.length > 0) {
      event.ports[0].postMessage({
        type: 'PONG',
        timestamp: Date.now(),
        status: 'active'
      });
    }
    return;
  }
}); 