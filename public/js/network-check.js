// Network check script with improved connectivity detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register the service worker
    // Note: next-pwa will actually register the compiled service worker at /sw.js
    navigator.serviceWorker.register('/sw.js', { 
      scope: '/' 
    }).then(registration => {
      console.log('SW registered successfully: ', registration);
      
      // Force update the service worker
      registration.update();
      
      // Check for updates every 5 minutes
      setInterval(() => {
        console.log('Checking for SW updates...');
        registration.update();
      }, 5 * 60 * 1000);
    }).catch(error => {
      console.log('SW registration failed: ', error);
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

  // Function to test connectivity to server
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