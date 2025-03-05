'use client';

import { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Define a Tour type (we'll extend this based on your actual data model)
interface Tour {
  id: string;
  name: string;
  location: string;
  date: string;
  duration: number;
  description?: string;
}

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
  const [isLoadingTours, setIsLoadingTours] = useState(false);
  
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

  // Load tours - currently empty implementation
  // In the future, you'll fetch actual tour data here
  useEffect(() => {
    if (user) {
      // For now, we're not loading any fake data
      // When you're ready to implement real tours, you'll add the API call here:
      // const fetchTours = async () => {
      //   try {
      //     const response = await fetch('/api/tours');
      //     const data = await response.json();
      //     setTours(data);
      //     setIsLoadingTours(false);
      //   } catch (error) {
      //     console.error('Error fetching tours:', error);
      //     setIsLoadingTours(false);
      //   }
      // };
      // fetchTours();
      
      setIsLoadingTours(false);
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

        {/* Tours list */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {isLoadingTours ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="ml-3 text-gray-600">Loading your tours...</p>
            </div>
          ) : tours.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {tours.map((tour) => (
                <li key={tour.id} className="hover:bg-gray-50">
                  <Link href={`/tour/${tour.id}`} className="block">
                    <div className="px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{tour.name}</h3>
                          <div className="mt-1 flex items-center text-sm text-gray-500">
                            <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            {tour.location}
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {tour.duration} min
                          </span>
                          <svg className="ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      {tour.description && (
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2">{tour.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 px-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tours found</h3>
              <p className="text-gray-500 mb-6">You haven't created any audio guides yet.</p>
            </div>
          )}
        </div>
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

