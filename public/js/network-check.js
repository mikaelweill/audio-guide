// Network check script with improved connectivity detection and service worker recovery
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Define our app URL for consistency
    const APP_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://audio-guide-theta.vercel.app';
      
    console.log('App running at:', APP_URL);
    
    // Track service worker registration attempts
    let registerAttempts = 0;
    const MAX_REGISTER_ATTEMPTS = 3;

    // Function to register service worker with retry
    const registerServiceWorker = () => {
      if (registerAttempts >= MAX_REGISTER_ATTEMPTS) {
        console.error('Max service worker registration attempts reached');
        return;
      }

      registerAttempts++;
      
      // Register the service worker
      // Note: next-pwa will actually register the compiled service worker at /sw.js
      navigator.serviceWorker.register('/sw.js', { 
        scope: '/' 
      }).then(registration => {
        console.log('SW registered successfully: ', registration);
        
        // Reset the attempt counter on success
        registerAttempts = 0;
        
        // Force update the service worker
        registration.update();
        
        // Track failed states
        if (registration.installing) {
          registration.installing.addEventListener('statechange', (event) => {
            if (event.target.state === 'redundant') {
              console.error('Service worker installation failed, will retry');
              setTimeout(registerServiceWorker, 5000);
            }
          });
        }
        
        // Check for updates every 5 minutes
        setInterval(() => {
          console.log('Checking for SW updates...');
          registration.update().catch(err => {
            console.error('Error updating service worker:', err);
          });
        }, 5 * 60 * 1000);
      }).catch(error => {
        console.error('SW registration failed: ', error);
        
        // Try again after a delay
        setTimeout(registerServiceWorker, 5000 * registerAttempts);
      });
    };

    // Start registration process
    registerServiceWorker();
    
    // Handle service worker error recovery
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed');
    });
    
    // Monitor for service worker errors
    window.addEventListener('error', (event) => {
      if (event.filename && event.filename.includes('/sw.js')) {
        console.error('Service worker error detected:', event);
        
        // Try to recover by unregistering and registering again
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
          }
          
          console.log('Unregistered problematic service workers, will retry');
          setTimeout(registerServiceWorker, 3000);
        });
      }
    });
  });
}

// Network status indicator with improved handling
window.addEventListener('load', () => {
  // Create network status indicator
  const statusElement = document.createElement('div');
  statusElement.id = 'network-status';
  statusElement.style.position = 'fixed';
  statusElement.style.bottom = '10px';
  statusElement.style.left = '10px';
  statusElement.style.padding = '5px 10px';
  statusElement.style.borderRadius = '5px';
  statusElement.style.fontSize = '12px';
  statusElement.style.zIndex = '9999';
  
  // Function to check if tours are cached
  const checkTourCache = async () => {
    try {
      if (!('caches' in window)) {
        console.log('Cache API not available');
        return false;
      }
      
      const cache = await caches.open('api-cache-v1');
      const keys = await cache.keys();
      const hasTourCache = keys.some(request => request.url.includes('/api/tours'));
      console.log('Cache check result:', hasTourCache ? 'Tours cached' : 'No tours cached');
      return hasTourCache;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  };

  // Function to test connectivity to server - improved with app URL awareness
  const testConnectivity = async () => {
    try {
      // First try the fetch API with our own API
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.ok) {
        console.log('Connected to server successfully');
        return true;
      }
    } catch (error) {
      console.log('Could not connect to server API:', error);
      
      // If first attempt fails, try with explicit production URL as a backup
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
          const backupResponse = await fetch('https://audio-guide-theta.vercel.app/api/health', { 
            method: 'HEAD',
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          if (backupResponse.ok) {
            console.log('Connected to production server successfully');
            return true;
          }
        } catch (backupError) {
          console.log('Could not connect to production server either:', backupError);
        }
      }
    }
    
    // If our API check fails, fallback to navigator.onLine
    return navigator.onLine;
  };
  
  // Function to update status with more reliable connectivity check
  const updateStatus = async () => {
    const isOnline = await testConnectivity();
    const hasCachedTours = await checkTourCache();
    
    if (isOnline) {
      statusElement.textContent = 'Online Mode';
      statusElement.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
      statusElement.style.color = 'green';
      
      // Attempt to reload data if we're back online after being offline
      if (statusElement.dataset.wasOffline === 'true') {
        console.log('Reconnected! Refreshing data...');
        // Only reload if we were on the tours page
        if (window.location.pathname === '/') {
          // Wait a moment for network to stabilize
          setTimeout(() => {
            fetch('/api/tours')
              .then(response => response.json())
              .then(data => {
                console.log('Successfully refreshed tour data');
                // You could dispatch a custom event here if needed
              })
              .catch(err => console.error('Failed to refresh data:', err));
          }, 1000);
        }
      }
      
      statusElement.dataset.wasOffline = 'false';
    } else {
      statusElement.dataset.wasOffline = 'true';
      
      if (hasCachedTours) {
        statusElement.textContent = 'Offline Mode (Cached Data)';
        statusElement.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
        statusElement.style.color = 'orange';
      } else {
        statusElement.textContent = 'Offline Mode (No Cache)';
        statusElement.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        statusElement.style.color = 'red';
      }
    }
  };
  
  // Initial status update
  updateStatus();
  
  // Add to DOM
  document.body.appendChild(statusElement);
  
  // Check connection status more frequently
  window.addEventListener('online', () => {
    console.log('Browser reports online');
    updateStatus();
  });
  window.addEventListener('offline', () => {
    console.log('Browser reports offline');
    updateStatus();
  });
  
  // Also periodically check connection (especially for mobile)
  setInterval(updateStatus, 30000); // Check every 30 seconds
  
  // Force API requests to go through service worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    console.log('Service Worker is controlling the page');
  } else {
    console.log('No Service Worker is controlling the page yet');
  }
}); 