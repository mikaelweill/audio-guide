'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';

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

export default function Home() {
  // State for user's location
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

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
    googleMapsApiKey: apiKey
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

  return (
    // Make sure this container takes the full height of the page
    <div className="h-screen w-full relative flex flex-col">
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
              <div className="absolute top-3 left-0 right-0 mx-auto w-fit px-4 py-2 bg-white bg-opacity-90 rounded-lg shadow-md z-10">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">{locationError}</span>
                  <button 
                    onClick={requestLocation}
                    className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full bg-gray-100 flex items-center justify-center">
            <div className="text-gray-400 text-center">
              <p>Loading map...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Create Tour Button - fixed at the bottom with better visibility */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center z-10">
        <Link 
          href="/tour" 
          className="bg-blue-600 text-white px-8 py-4 rounded-md shadow-xl hover:bg-blue-700 transition duration-200 font-medium"
        >
          Create Tour
        </Link>
      </div>
    </div>
  );
}
