'use client';

import { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import TourList, { Tour } from '@/components/TourList';

// Default center (will be replaced with user's location)
const defaultCenter = {
  lat: 40.7128, // New York
  lng: -74.0060
};

// Define libraries as a constant to maintain reference stability
const libraries: Libraries = ['places'];

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  
  // State for tours
  const [tours, setTours] = useState<Tour[]>([]);
  const [isLoadingTours, setIsLoadingTours] = useState(true);
  
  // State needed for modal functionality
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Extract API key
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  // Load Google Maps API (needed for the modal)
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries
  });
  
  // Modal callbacks
  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  
  // Function to handle location errors
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
  
  // Request user location
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

  // Check authentication
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('Home page: User not authenticated, redirecting to login');
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Load tours from the API
  useEffect(() => {
    if (user) {
      const fetchTours = async () => {
        try {
          setIsLoadingTours(true);
          console.log('Fetching tours...');
          
          const response = await fetch('/api/tours', {
            credentials: 'include' // Important: send cookies with the request
          });
          
          if (!response.ok) {
            throw new Error(`Error fetching tours: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.success && Array.isArray(data.tours)) {
            console.log(`Fetched ${data.tours.length} tours`);
            setTours(data.tours);
          } else {
            console.error('Invalid data format:', data);
            setTours([]);
          }
        } catch (error) {
          console.error('Error fetching tours:', error);
          setTours([]);
        } finally {
          setIsLoadingTours(false);
        }
      };
      
      fetchTours();
    }
  }, [user]);
  
  // Initialize user location on first load
  useEffect(() => {
    if (isLoaded) {
      requestUserLocation();
    }
  }, [isLoaded, requestUserLocation]);

  // Loading state while checking authentication
  if (isLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Audio Guides</h1>
          <p className="mt-2 text-gray-600">Explore your saved audio guides or create a new one.</p>
        </div>

        {/* Create new tour button */}
        <div className="mb-8">
          <button 
            onClick={openModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-md shadow-lg hover:bg-blue-700 transition-colors"
          >
            Create New Audio Guide
          </button>
        </div>

        {/* Display tours using the TourList component */}
        <TourList tours={tours} loading={isLoadingTours} />
      </div>

      {/* Only render TourModal when it's open to prevent unnecessary API calls */}
      {modalOpen && (
        <TourModal 
          isOpen={modalOpen} 
          onClose={closeModal} 
          userLocation={userLocation} 
          mapsApiLoaded={isLoaded} 
        />
      )}
    </div>
  );
}

