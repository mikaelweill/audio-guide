'use client';

import { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import TourList, { Tour } from '@/components/TourList';

// Extract tour fetching logic to a separate client component
function TourLoader({ onToursLoaded }: { onToursLoaded: (tours: Tour[]) => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  
  // Simple fetch function
  useEffect(() => {
    const fetchTours = async () => {
      console.log('🔄 TOUR LOADER: Fetching tours');
      setIsLoading(true);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch('/api/tours', {
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: Failed to load tours`);
        }
        
        const data = await response.json();
        
        if (data.success && Array.isArray(data.tours)) {
          console.log(`✅ TOUR LOADER: Loaded ${data.tours.length} tours`);
          setTours(data.tours);
          onToursLoaded(data.tours);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('❌ TOUR LOADER: Error loading tours:', error);
        setError(error instanceof Error ? error.message : 'Failed to load tours');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTours();
  }, [onToursLoaded]);
  
  if (isLoading) {
    return (
      <div className="w-full py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-3"></div>
          <p>Loading your tours...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="w-full py-6 px-4 bg-red-50 rounded-lg border border-red-200 mb-8">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return null;
}

// Main Home component with simplified structure - no auth checks needed
export default function Home() {
  console.log('🏠 HOME: Component rendering');
  
  // Tours state
  const [tours, setTours] = useState<Tour[]>([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  // Google Maps
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Load Google Maps API
  const libraries = ["places"];
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as Libraries,
  });
  
  // Get user location (simplified)
  const requestUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setLocationError(`Location error: ${error.message}`);
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, []);
  
  // Initialize user location on first load
  useEffect(() => {
    if (isLoaded) {
      requestUserLocation();
    }
  }, [isLoaded, requestUserLocation]);
  
  // Handler for tour data loading
  const handleToursLoaded = useCallback((loadedTours: Tour[]) => {
    console.log(`📋 HOME: Tours loaded callback with ${loadedTours.length} tours`);
    setTours(loadedTours);
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Audio Guides</h1>
          <p className="mt-2 text-gray-600">Explore your saved audio guides or create a new one.</p>
        </div>
        
        {/* Location error notification */}
        {locationError && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.873-1.012 2.395-1.012 3.27 0l7.5 8.64c.87 1.008.27 2.615-1.032 2.615H2.015c-1.304 0-1.906-1.607-1.033-2.614l7.503-8.64zM10 5a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1zm0 9a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-yellow-700">{locationError}</p>
            </div>
          </div>
        )}
        
        {/* Create new tour button */}
        <div className="mb-8">
          <button 
            onClick={openModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create New Audio Guide
          </button>
        </div>
        
        {/* Tour loader component */}
        <TourLoader onToursLoaded={handleToursLoaded} />
        
        {/* Tour list */}
        <TourList tours={tours} loading={false} />
        
        {/* Tour creation modal */}
        <TourModal 
          isOpen={isModalOpen} 
          onClose={closeModal} 
          userLocation={userLocation || undefined}
          mapsApiLoaded={isLoaded}
        />
      </div>
    </div>
  );
} 