'use client';

import { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';

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
  // State for layout type
  const [layoutType, setLayoutType] = useState<'fullscreen' | 'contained'>('contained');
  
  // State for user's location
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Add an effect to prevent scrolling
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

  // Extract and log API key status
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  useEffect(() => {
    console.log("API Key status:", apiKey ? "Key exists (length: " + apiKey.length + ")" : "Key missing");
    
    if (!apiKey) {
      setApiKeyError("Google Maps API key is missing in environment variables");
    }
  }, [apiKey]);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries
  });

  // Handle load error
  useEffect(() => {
    if (loadError) {
      console.error("Google Maps load error:", loadError);
      setApiKeyError("Failed to load Google Maps: " + loadError.message);
    }
  }, [loadError]);

  // Request user's location
  const requestLocation = useCallback(() => {
    setLocationError(null);
    setShowPermissionHelp(false);
    
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
            // More robust error handling
            console.error('Error getting user location:', error);
            
            let errorMessage = "Could not determine your location. Using default location instead.";
            
            // Check if error has the expected structure
            if (error && typeof error === 'object') {
              if ('code' in error) {
                if (error.code === 1) { // PERMISSION_DENIED
                  errorMessage = "Location access was denied. Using default location instead.";
                  // Also set a flag to show permission help
                  setShowPermissionHelp(true);
                } else if (error.code === 2) { // POSITION_UNAVAILABLE
                  errorMessage = "Your location is currently unavailable. Using default location instead.";
                } else if (error.code === 3) { // TIMEOUT
                  errorMessage = "Location request timed out. Using default location instead.";
                }
              }
            }
            
            setLocationError(errorMessage);
            setLocationLoaded(true); // Still set to true so we can show the default location
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } catch (e) {
        console.error('Exception in geolocation request:', e);
        setLocationError("Error requesting location. Using default location instead.");
        setLocationLoaded(true);
      }
    } else {
      console.error('Geolocation is not supported by this browser');
      setLocationError("Your browser doesn't support geolocation. Using default location instead.");
      setLocationLoaded(true);
    }
  }, []);

  // Get user's location on first load
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Map reference
  const [map, setMap] = useState<MapType>(null);
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);
  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Handle opening and closing the modal
  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  // Toggle layout type
  const toggleLayout = useCallback(() => {
    setLayoutType(prev => prev === 'fullscreen' ? 'contained' : 'fullscreen');
  }, []);

  if (layoutType === 'fullscreen') {
    // Fullscreen layout with floating button
    return (
      <div className="h-screen w-full relative flex flex-col overflow-hidden">
        {/* Google Map or Error Message */}
        <div className="flex-grow">
          {apiKeyError ? (
            <div className="h-full bg-red-50 flex items-center justify-center p-4">
              <div className="text-red-600 text-center max-w-lg">
                <h2 className="text-xl font-bold mb-2">Google Maps Error</h2>
                <p>{apiKeyError}</p>
                <p className="mt-4 text-sm">
                  Please check your API key in the .env file and make sure the Maps JavaScript API is enabled in Google Cloud Console.
                </p>
              </div>
            </div>
          ) : isLoaded ? (
            <div className="h-full relative">
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
                  fullscreenControl: false
                }}
              >
                {/* User location marker */}
                <MarkerF position={userLocation} />
              </GoogleMap>
              
              {/* Location error notification */}
              {locationError && (
                <div className="absolute top-3 left-0 right-0 mx-auto w-auto max-w-md px-4 py-3 bg-white bg-opacity-95 rounded-lg shadow-md z-10">
                  <div className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-yellow-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <span className="text-sm font-medium">{locationError}</span>
                      
                      {showPermissionHelp && (
                        <div className="mt-2 text-xs">
                          <button 
                            onClick={() => setShowPermissionHelp(prev => !prev)}
                            className="text-blue-600 hover:underline focus:outline-none"
                          >
                            How to enable location access
                          </button>
                          
                          {showPermissionHelp && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-gray-700">
                              <p className="font-medium mb-1">Enable location in your browser:</p>
                              <ul className="list-disc pl-5 space-y-1">
                                <li><span className="font-medium">Chrome:</span> Click the lock/info icon in the address bar → Site settings → Location → Allow</li>
                                <li><span className="font-medium">Safari:</span> Click Safari menu → Preferences → Websites → Location → Allow for this website</li>
                                <li><span className="font-medium">Firefox:</span> Click the shield icon in the address bar → Site Permissions → Location → Allow</li>
                                <li><span className="font-medium">Edge:</span> Click the lock icon → Site permissions → Location → Allow</li>
                              </ul>
                              <p className="mt-2 text-gray-500 italic">After changing this setting, refresh the page or click the Retry button.</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <button 
                          onClick={requestLocation}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Create Tour Button - positioned at the bottom of the screen */}
              <div className="fixed bottom-16 left-0 right-0 flex justify-center z-20">
                <button
                  onClick={openModal}
                  className="bg-blue-600 text-white px-8 py-3 rounded-md shadow-xl hover:bg-blue-700 transition duration-200 font-medium text-lg cursor-pointer"
                >
                  Create Tour
                </button>
              </div>
              
              {/* Layout Toggle */}
              <button 
                onClick={toggleLayout}
                className="absolute top-3 right-3 z-10 bg-white p-2 rounded-full shadow-lg cursor-pointer"
                title="Switch to contained layout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 0v12h12V4H5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="h-full bg-gray-100 flex items-center justify-center">
              <div className="text-gray-400 text-center">
                <p>Loading map...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Tour Creation Modal */}
        <TourModal isOpen={modalOpen} onClose={closeModal} userLocation={userLocation} mapsApiLoaded={isLoaded} />
      </div>
    );
  }
  
  // Contained layout with button below
  return (
    <div className="h-screen w-full bg-gray-50 overflow-auto flex flex-col">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-8 flex flex-col min-h-[calc(100%-2rem)]">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Audio Travel Guide</h1>
          <p className="text-gray-600">Discover personalized audio tours based on your interests</p>
        </div>
        
        {/* Map Container - Limit height to ensure button is visible */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex-1 mb-6" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <div className="h-full relative overflow-hidden">
            {apiKeyError ? (
              <div className="h-full bg-red-50 flex items-center justify-center p-4">
                <div className="text-red-600 text-center max-w-lg">
                  <h2 className="text-xl font-bold mb-2">Google Maps Error</h2>
                  <p>{apiKeyError}</p>
                  <p className="mt-4 text-sm">
                    Please check your API key in the .env file and make sure the Maps JavaScript API is enabled in Google Cloud Console.
                  </p>
                </div>
              </div>
            ) : isLoaded ? (
              <div className="h-full relative">
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
                    fullscreenControl: false
                  }}
                >
                  {/* User location marker */}
                  <MarkerF position={userLocation} />
                </GoogleMap>
                
                {/* Location error notification */}
                {locationError && (
                  <div className="absolute top-3 left-0 right-0 mx-auto w-auto max-w-md px-4 py-3 bg-white bg-opacity-95 rounded-lg shadow-md z-10">
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-yellow-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <span className="text-sm font-medium">{locationError}</span>
                        
                        {showPermissionHelp && (
                          <div className="mt-2 text-xs">
                            <button 
                              onClick={() => setShowPermissionHelp(prev => !prev)}
                              className="text-blue-600 hover:underline focus:outline-none cursor-pointer"
                            >
                              How to enable location access
                            </button>
                            
                            {showPermissionHelp && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-gray-700">
                                <p className="font-medium mb-1">Enable location in your browser:</p>
                                <ul className="list-disc pl-5 space-y-1">
                                  <li><span className="font-medium">Chrome:</span> Click the lock/info icon in the address bar → Site settings → Location → Allow</li>
                                  <li><span className="font-medium">Safari:</span> Click Safari menu → Preferences → Websites → Location → Allow for this website</li>
                                  <li><span className="font-medium">Firefox:</span> Click the shield icon in the address bar → Site Permissions → Location → Allow</li>
                                  <li><span className="font-medium">Edge:</span> Click the lock icon → Site permissions → Location → Allow</li>
                                </ul>
                                <p className="mt-2 text-gray-500 italic">After changing this setting, refresh the page or click the Retry button.</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <button 
                            onClick={requestLocation}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Layout Toggle */}
                <button 
                  onClick={toggleLayout}
                  className="absolute top-3 right-3 z-10 bg-white p-2 rounded-full shadow-lg cursor-pointer"
                  title="Switch to fullscreen layout"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="h-full bg-gray-100 flex items-center justify-center">
                <div className="text-gray-400 text-center">
                  <p>Loading map...</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Create Tour Button - Fixed position with proper spacing */}
        <div className="py-0 mt-4 mb-4">
          <button
            onClick={openModal}
            className="w-full bg-blue-600 text-white py-3 rounded-lg shadow-md hover:bg-blue-700 transition duration-200 font-medium text-lg cursor-pointer"
          >
            Create Tour
          </button>
        </div>
      </div>
      
      {/* Tour Creation Modal */}
      <TourModal isOpen={modalOpen} onClose={closeModal} userLocation={userLocation} mapsApiLoaded={isLoaded} />
    </div>
  );
}
