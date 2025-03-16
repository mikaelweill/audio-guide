    // This service worker can be customized!
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing new service worker...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
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

// Fetch handler with improved offline support
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip handling Supabase storage requests to avoid CORS issues
  if (url.hostname.includes('supabase.co')) {
    // Let the browser handle Supabase requests normally without service worker interference
    return; // Important: this exits the event handler without calling respondWith
  }
  
  // Skip handling external API requests that might have their own CORS requirements
  if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1') && !self.location.hostname.includes(url.hostname)) {
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