'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

// Default center (will be replaced with user's location)
const defaultCenter = {
  lat: 40.7128, // New York
  lng: -74.0060
};

type MapType = google.maps.Map | null;

// Define libraries as a constant to maintain reference stability
const libraries: Libraries = ['places'];

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  
  // All state declarations
  const [layoutType, setLayoutType] = useState<'fullscreen' | 'contained'>('contained');
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [map, setMap] = useState<MapType>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Extract API key - add debugging info
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  console.log("API Key first/last 4 chars:", apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "No key found");
  
  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries
  });
  
  // ALL callbacks defined at the top level in the same order every render
  // Callback for map load
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);
  
  // Callback for map unmount
  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);
  
  // Modal callbacks
  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  
  // Layout toggle callback
  const toggleLayout = useCallback(() => {
    setLayoutType(prev => prev === 'fullscreen' ? 'contained' : 'fullscreen');
  }, []);
  
  // Function to handle location errors - defined with useCallback for consistency
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = "Could not determine your location. Using default location instead.";
    
    if (error.code === 1) {
      // Permission denied
      errorMessage = "Location permission denied. Using default location instead.";
      setShowPermissionHelp(true);
    } else if (error.code === 2) {
      // Position unavailable
      errorMessage = "Your location is currently unavailable. Using default location instead.";
    } else if (error.code === 3) {
      // Timeout
      errorMessage = "Location request timed out. Using default location instead.";
    }
    
    setLocationError(errorMessage);
    console.error(`Geolocation error: ${errorMessage} (Code: ${error.code})`);
  }, []);
  
  // Request user location function
  const requestUserLocation = useCallback(() => {
    setLocationError(null);
    setShowPermissionHelp(false);
    
    if (!isLoaded) return; // Only proceed if Maps API is loaded
    
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setLocationLoaded(true);
            setLocationError(null);
          },
          (error) => {
            // Handle geolocation errors
            console.error('Error getting user location:', error);
            handleLocationError(error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } catch (e) {
        console.error('Exception in geolocation request:', e);
        setLocationError("Error accessing location. Using default location instead.");
      }
    } else {
      console.error('Geolocation is not supported by this browser');
      setLocationError("Your browser doesn't support geolocation. Using default location instead.");
    }
  }, [isLoaded, handleLocationError]);
  
  // Function to retry loading Google Maps
  const retryGoogleMapsLoad = useCallback(() => {
    // Force reloading of the Google Maps script
    // We can do this by incrementing the retry count, which will cause 
    // a remount of the GoogleMap components
    setRetryCount(prev => prev + 1);
    
    // Clear errors to give feedback to user that retry is in progress
    setApiKeyError(null);
    
    console.log("Retrying Google Maps load, attempt:", retryCount + 1);
  }, [retryCount]);
  
  // After the retryGoogleMapsLoad function
  // Fallback UI when Google Maps can't load
  const MapFallback = useCallback(() => (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-4">
      <div className="text-center max-w-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Map Loading Issue</h2>
        <p className="text-gray-600 mb-4">We're having trouble loading Google Maps. This could be due to API key issues or network connectivity.</p>
        <div className="flex justify-center space-x-2">
          <button 
            onClick={retryGoogleMapsLoad}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Retry Loading Maps
          </button>
        </div>
        {apiKeyError && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            <p className="font-medium">Error Details:</p>
            <p>{apiKeyError}</p>
          </div>
        )}
      </div>
    </div>
  ), [apiKeyError, retryGoogleMapsLoad]);
  
  // All useEffect hooks
  // Client-side authentication check 
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('Home page: User not authenticated, redirecting to login');
      router.replace('/login');
    }
  }, [user, isLoading, router]);
  
  // Effect to prevent scrolling
  useEffect(() => {
    // Save original styles
    const originalStyle = window.getComputedStyle(document.body).overflow;
    
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    
    // Restore original styles when component unmounts
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
  
  // API key check
  useEffect(() => {
    console.log("API Key status:", apiKey ? "Key exists (length: " + apiKey.length + ")" : "Key missing");
    
    if (!apiKey) {
      setApiKeyError("Google Maps API key is missing in environment variables");
    }
  }, [apiKey]);
  
  // Handle load error with more specific messages
  useEffect(() => {
    if (loadError) {
      console.error("Google Maps load error:", loadError);
      
      // Check for specific error types
      if (loadError.message?.includes('ApiTargetBlockedMapError')) {
        setApiKeyError(
          "Your Google Maps API key is blocked or restricted. This could be due to billing issues, " +
          "project suspension, or domain restrictions. Please check your Google Cloud Console."
        );
      } else {
        setApiKeyError("Failed to load Google Maps: " + loadError.message);
      }
    }
  }, [loadError]);
  
  // Initialize user location on first load
  useEffect(() => {
    if (isLoaded) {
      requestUserLocation();
    }
  }, [isLoaded, requestUserLocation]);
  
  // Early return if loading or not authenticated
  if (isLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Checking authentication...</p>
      </div>
    );
  }

  // Render component
  return (
    <div className="h-screen flex flex-col">
      {layoutType === 'fullscreen' ? (
        // Fullscreen layout
        <div className="flex-grow relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={userLocation}
              zoom={15}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              }}
            >
              {/* User location marker */}
              <MarkerF position={userLocation} />
              
              {/* Error notifications */}
              {locationError && (
                <div className="absolute top-0 left-0 right-0 m-2 p-2 bg-white border-l-4 border-orange-500 text-orange-700 z-50 shadow-md rounded">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <p className="text-sm">{locationError}</p>
                      {showPermissionHelp && (
                        <div className="mt-2">
                          <button 
                            onClick={requestUserLocation}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            Try Again
                          </button>
                          <p className="text-xs mt-1">Tip: You may need to enable location access in your browser settings</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {apiKeyError && (
                <div className="absolute top-0 left-0 right-0 m-2 p-2 bg-white border-l-4 border-red-500 text-red-700 z-50 shadow-md rounded">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <p className="text-sm">{apiKeyError}</p>
                      <div className="mt-2">
                        <button 
                          onClick={retryGoogleMapsLoad}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer mr-2"
                        >
                          Retry Loading Maps
                        </button>
                        <button 
                          onClick={requestUserLocation}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Try Again with Location
                        </button>
                      </div>
                      {retryCount > 0 && (
                        <p className="text-xs mt-1">Retry attempts: {retryCount}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Create Tour Button - positioned at the bottom of the screen */}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                <button
                  onClick={openModal}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                >
                  Create Audio Guide
                </button>
              </div>
              
              {/* Layout Toggle */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={toggleLayout}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>
            </GoogleMap>
          ) : loadError ? (
            <MapFallback />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center p-6">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading maps...</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Contained layout
        <div className="flex-grow p-4 md:p-8 relative">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full">
            <div className="h-full relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={userLocation}
                  zoom={15}
                  onLoad={onLoad}
                  onUnmount={onUnmount}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                  }}
                >
                  {/* User location marker */}
                  <MarkerF position={userLocation} />
                  
                  {/* Location error notification */}
                  {locationError && (
                    <div className="absolute top-0 left-0 right-0 m-2 p-2 bg-white border-l-4 border-orange-500 text-orange-700 z-50 shadow-md rounded">
                      <div className="flex items-start">
                        <div className="flex-1">
                          <p className="text-sm">{locationError}</p>
                          {showPermissionHelp && (
                            <div className="mt-2">
                              <button 
                                onClick={requestUserLocation}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer"
                              >
                                Try Again
                              </button>
                              <p className="text-xs mt-1">Tip: You may need to enable location access in your browser settings</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {apiKeyError && (
                    <div className="absolute top-0 left-0 right-0 m-2 p-2 bg-white border-l-4 border-red-500 text-red-700 z-50 shadow-md rounded">
                      <div className="flex items-start">
                        <div className="flex-1">
                          <p className="text-sm">{apiKeyError}</p>
                          <div className="mt-2">
                            <button 
                              onClick={retryGoogleMapsLoad}
                              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer mr-2"
                            >
                              Retry Loading Maps
                            </button>
                            <button 
                              onClick={requestUserLocation}
                              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              Try Again with Location
                            </button>
                          </div>
                          {retryCount > 0 && (
                            <p className="text-xs mt-1">Retry attempts: {retryCount}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Layout Toggle */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={toggleLayout}
                      className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                      </svg>
                    </button>
                  </div>
                </GoogleMap>
              ) : loadError ? (
                <MapFallback />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <div className="text-center p-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading maps...</p>
                  </div>
                </div>
              )}
              
              {/* Create Tour Button - positioned at the bottom of the screen */}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                <button
                  onClick={openModal}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                >
                  Create Audio Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tour Creation Modal */}
      {modalOpen && <TourModal 
        isOpen={modalOpen} 
        onClose={closeModal} 
        userLocation={userLocation}
        mapsApiLoaded={isLoaded} 
      />}
    </div>
  );
}

