'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import TourList, { Tour } from '@/components/TourList';
import { toast } from 'react-hot-toast';

// Extract tour fetching logic to a separate client component
function TourLoader({ onToursLoaded }: { onToursLoaded: (tours: Tour[]) => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const subscriptionRef = useRef(null);
  
  // Simple fetch function made accessible
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
        
        // Simple subscription - set up only once
        if (!subscriptionRef.current) {
          console.log('🔌 Creating Supabase real-time subscription to Tour table');
          const { createClient } = require('@/utils/supabase/client'); 
          const supabase = createClient();
          
          // Enable realtime on the tours table
          const channel = supabase.channel('tour-changes')
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'Tour'
            }, (payload: { eventType: string }) => {
              console.log(`🔄 Tour table changed (${payload.eventType}) - refreshing`);
              fetchTours();
            })
            .subscribe();
            
          subscriptionRef.current = channel;
        }
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
  
  // Expose the fetchTours function to parent components
  useEffect(() => {
    // Create a reference to the function on the DOM element for other components to access
    const loaderElement = document.querySelector('[data-tour-loader="true"]');
    if (loaderElement) {
      // @ts-ignore - Adding custom property to the DOM element
      loaderElement.loadTours = fetchTours;
    }
    
    return () => {
      // Clean up reference when unmounted
      const loaderElement = document.querySelector('[data-tour-loader="true"]');
      if (loaderElement) {
        // @ts-ignore
        delete loaderElement.loadTours;
      }
      
      // Clean up subscription
      if (subscriptionRef.current) {
        try {
          const { createClient } = require('@/utils/supabase/client');
          const supabase = createClient();
          supabase.removeChannel(subscriptionRef.current);
          console.log('Subscription cleaned up');
        } catch (error) {
          console.error('Error cleaning up subscription:', error);
        }
      }
    };
  }, []);
  
  // Initial load
  useEffect(() => {
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

  // New function to save tour data to database
  const saveTour = async (tourData: any) => {
    try {
      console.log('💾 HOME: Saving tour to database...', {
        tourName: tourData.name,
        numPOIs: tourData.route.length,
        hasWebsites: tourData.route.some((poi: any) => poi.details?.website)
      });
      
      // Prepare POI data for serialization
      const serializedTourData = {
        ...tourData,
        route: tourData.route.map((poi: any) => {
          // Extract photo data, converting getUrl methods to actual URLs
          const preparedPhotos = poi.photos?.map((photo: any) => {
            const preparedPhoto: any = {
              width: photo.width,
              height: photo.height,
              html_attributions: photo.html_attributions || []
            };
            
            // If getUrl is available, store the actual URL
            if (typeof photo.getUrl === 'function') {
              try {
                preparedPhoto.url = photo.getUrl({ maxWidth: 800 });
              } catch (error) {
                console.warn('Failed to get photo URL:', error);
              }
            }
            
            // Always include photo_reference if available
            if (photo.photo_reference) {
              preparedPhoto.photo_reference = photo.photo_reference;
            }
            
            return preparedPhoto;
          }) || [];
          
          // Return a cleaned POI object
          return {
            place_id: poi.place_id,
            name: poi.name,
            types: poi.types || [],
            vicinity: poi.vicinity || '',
            geometry: {
              location: {
                lat: poi.geometry.location.lat,
                lng: poi.geometry.location.lng
              }
            },
            photos: preparedPhotos,
            rating: poi.rating,
            user_ratings_total: poi.user_ratings_total,
            // Safely extract details
            details: poi.details ? {
              formatted_address: poi.details.formatted_address,
              formatted_phone_number: poi.details.formatted_phone_number,
              website: poi.details.website,
              price_level: poi.details.price_level,
              // Handle opening_hours more safely
              opening_hours: poi.details.opening_hours ? {
                weekday_text: poi.details.opening_hours.weekday_text || [],
                // Convert isOpen function to open_now value if possible
                open_now: typeof poi.details.opening_hours.isOpen === 'function' 
                  ? poi.details.opening_hours.isOpen()
                  : poi.details.opening_hours.open_now,
                periods: poi.details.opening_hours.periods || []
              } : null
            } : null
          };
        })
      };
      
      // Save to database using the API with properly serialized data
      const response = await fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializedTourData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      // Parse and validate response
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid response from server: ${response.status}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to save tour');
      }
      
      console.log('✅ HOME: Tour saved successfully with ID:', data.tourId);
      console.log('🔄 HOME: Check if realtime update is received automatically...');
      
      // If we have valid tour data with POIs, process them with Supabase
      if (tourData.route && tourData.route.length > 0) {
        processPOIsWithSupabase(tourData.route, data.tourId);
      }
      
      // Force refresh the tour list
      const tourLoader = document.querySelector('[data-tour-loader="true"]');
      if (tourLoader) {
        // @ts-ignore
        tourLoader.loadTours?.();
      }
    } catch (error) {
      console.error('❌ HOME: Error saving tour:', error);
      toast.error(`Failed to save tour: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Process POIs with Supabase Edge Function
  const processPOIsWithSupabase = async (pois: any[], tourId: string) => {
    try {
      console.log(`🔊 HOME: Processing ${pois.length} POIs in parallel with individual Edge Function calls...`);
      
      const { createClient } = require('@/utils/supabase/client');
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      
      if (accessToken && pois.length > 0) {
        // Process all POIs in parallel instead of just 3
        const poisToProcess = pois;
        console.log(`🎯 Processing ${poisToProcess.length} POIs in parallel`);
        
        // First, fetch Wikipedia & Wikivoyage content for each POI
        const poisWithExtracts = await Promise.all(
          poisToProcess.map(async (poi) => {
            try {
              // Get Wikipedia extract if available
              const wikipediaResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(poi.name)}`);
              const wikipediaData = wikipediaResponse.ok ? await wikipediaResponse.json() : null;
              
              // Get Wikivoyage extract if available (simplified - this would need actual wikivoyage API)
              const wikivoyageData = null; // For now, we'll just use Wikipedia data
              
              return {
                ...poi,
                extraData: {
                  wikipedia: wikipediaData ? {
                    extract: wikipediaData.extract || "No Wikipedia information found.",
                    url: wikipediaData.content_urls?.desktop?.page || ""
                  } : { extract: "No Wikipedia information available." },
                  wikivoyage: wikivoyageData || { extract: "No Wikivoyage information available." }
                }
              };
            } catch (error) {
              console.error(`Error fetching data for POI ${poi.name}:`, error);
              return {
                ...poi,
                extraData: {
                  wikipedia: { extract: "Could not fetch Wikipedia data." },
                  wikivoyage: { extract: "Could not fetch Wikivoyage data." }
                }
              };
            }
          })
        );
        
        // Create an array of promises (one for each POI)
        const processingPromises = poisWithExtracts.map(poi => {
          console.log(`Creating promise for POI: ${poi.name} (ID: ${poi.id}, place_id: ${poi.place_id})`);
          console.log(`Wikipedia extract length: ${poi.extraData?.wikipedia?.extract?.length || 0} characters`);
          
          return fetch(
            'https://uzqollduvddowyzjvmzn.supabase.co/functions/v1/process-poi',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ 
                poiData: {
                  id: poi.id, // Send the UUID format ID that the frontend expects
                  place_id: poi.place_id,
                  basic: {
                    name: poi.name,
                    formatted_address: poi.vicinity || poi.formatted_address || '',
                    location: poi.geometry?.location || { lat: 0, lng: 0 },
                    types: poi.types || ["point_of_interest"],
                  },
                  wikipedia: poi.extraData?.wikipedia || { extract: "No Wikipedia information available." },
                  wikivoyage: poi.extraData?.wikivoyage || { extract: "No Wikivoyage information available." }
                }
              }),
            }
          )
          .then(async response => {
            console.log(`🎙️ POI ${poi.name} response status:`, response.status);
            if (response.ok) {
              const result = await response.json();
              console.log(`✅ POI ${poi.name} succeeded:`, result);
              
              // Check if the response has the expected data structure
              if (result.success) {
                return { 
                  poi, 
                  success: true, 
                  result,
                  audioUrls: result.result?.audioUrls || {} 
                };
              } else {
                console.error(`Response indicates failure for POI ${poi.name}:`, result);
                return { poi, success: false, error: result.error || "Unknown error" };
              }
            } else {
              const errorText = await response.text();
              console.error(`❌ POI ${poi.name} failed:`, errorText);
              return { poi, success: false, error: errorText };
            }
          })
          .catch(error => {
            console.error(`❌ Error processing POI ${poi.name}:`, error);
            return { poi, success: false, error };
          });
        });
        
        // Wait for all POIs to be processed in parallel
        console.log(`Waiting for all ${processingPromises.length} POIs to complete processing...`);
        const results = await Promise.all(processingPromises);
        
        // Report summary and show toast notification
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Successfully processed ${successCount} of ${results.length} POIs`);
        
        // For successful results, log the audio URLs
        results.filter(r => r.success).forEach(r => {
          // Use optional chaining and type assertion to avoid TypeScript errors
          const successResult = r as { poi: any; success: true; result: any; audioUrls: any };
          console.log(`Audio URLs for POI ${successResult.poi.name}:`, successResult.result?.result?.audioUrls || 'No audio URLs found');
        });
        
        if (successCount > 0) {
          toast.success(`Successfully processed ${successCount} points of interest`);
        } else {
          toast.error("Failed to process any points of interest");
        }
      } else {
        console.warn("⚠️ HOME: No access token or POIs available for Supabase functions");
      }
    } catch (error) {
      console.error("❌ HOME: Error with Supabase functions:", error);
      toast.error("Error processing tour content");
    }
  };
  
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
        
        {/* Tour creation modal - with new onSave prop */}
        <TourModal 
          isOpen={isModalOpen} 
          onClose={closeModal} 
          onSave={(tourData) => {
            // First close the modal immediately
            closeModal();
            // Then handle the saving separately
            saveTour(tourData);
          }}
          userLocation={userLocation || undefined}
          mapsApiLoaded={isLoaded}
        />
      </div>
    </div>
  );
} 