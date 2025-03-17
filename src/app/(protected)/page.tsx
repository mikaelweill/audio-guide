'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import TourList, { Tour } from '@/components/TourList';
import { toast } from 'react-hot-toast';
import { RTVIClientProvider, RTVIClientAudio } from '@pipecat-ai/client-react';
import { RTVIClient } from '@pipecat-ai/client-js';
import { DailyTransport } from '@pipecat-ai/daily-transport';
import { isPwa } from '@/services/offlineTourService';

const client = new RTVIClient({
  transport: new DailyTransport(),
  params: {
    baseUrl: 'https://server-damp-log-5089.fly.dev',
    requestData: {
      services: {
        stt: "deepgram",
        tts: "cartesia",
        llm: "gemini",
      },
      api_keys: {
        gemini: process.env.GEMINI_API_KEY
      },
      voice: 'cCIUSv3TlEi0E3OFQkzf',
      config: [
        {
          service: "llm",
          options: [
            {
              name: "model",
              value: "gemini-2.0-flash-exp"
            },
            {
              name: "temperature",
              value: 0.7
            },
            {
              name: "initial_messages",
              value: [
                {
                  role: "user",
                  content: "I want you to act as a tour guide. You are enthusiastic, knowledgeable, and helpful. Keep your responses brief and conversational. Your responses will be spoken out loud, so speak naturally."
                }
              ]
            }
          ]
        }
      ]
    }
  }
})
// Extract tour fetching logic to a separate client component
function TourLoader({
  onToursLoaded,
  currentPage,
  limit,
  onLoadingChange
}: {
  onToursLoaded: (tours: Tour[], pagination?: { total: number, pages: number }) => void;
  currentPage: number;
  limit: number;
  onLoadingChange?: (isLoading: boolean) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTours, setTotalTours] = useState(0);
  const subscriptionRef = useRef(null);

  // Notify parent about loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  const fetchTours = async (page = currentPage, pageLimit = limit) => {
    console.log(`🔄 TOUR LOADER: Fetching tours for page ${page} with limit ${pageLimit}`);
    setIsLoading(true);

    // Notify parent component about loading state
    if (onLoadingChange) {
      onLoadingChange(true);
    }

    try {
      const response = await fetch(`/api/tours?page=${page}&limit=${pageLimit}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: Failed to load tours`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.tours)) {
        console.log(`✅ TOUR LOADER: Loaded ${data.tours.length} tours (page ${page} of ${data.pagination?.pages || 1})`);
        setTours(data.tours);
        setTotalPages(data.pagination?.pages || 1);
        setTotalTours(data.pagination?.total || data.tours.length);

        // Pass both tours and pagination data
        onToursLoaded(data.tours, data.pagination);

        // Enable realtime subscription if not already set up
        if (!subscriptionRef.current) {
          const { createClient } = require('@/utils/supabase/client');
          const supabase = createClient();

          const channel = supabase.channel('tour-changes')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'Tour',
              },
              (payload: any) => {
                console.log('🔌 REALTIME: Tour change detected', payload);
                fetchTours();
              }
            )
            .subscribe();

          subscriptionRef.current = channel;
        }
      } else {
        console.error('❌ TOUR LOADER: Invalid tour data format');
        setError('Invalid tour data format');
      }
    } catch (err: any) {
      console.error('❌ TOUR LOADER: Error fetching tours', err);
      setError(err.message || 'Failed to load tours');
    } finally {
      setIsLoading(false);

      // Notify parent component about loading state
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  // Load tours whenever currentPage or limit changes (since they're now props)
  useEffect(() => {
    console.log(`🔄 TOUR LOADER: Page changed to ${currentPage}, fetching new data`);
    fetchTours(currentPage, limit);

    // Clean up subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        console.log('🔌 Cleaning up Supabase real-time subscription');
        const { createClient } = require('@/utils/supabase/client');
        const supabase = createClient();
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [currentPage, limit]); // Dependencies now come from props

  return null; // This component is just for data fetching
}

// CSS for Globe and Map Styling
const globeStyles = `
  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  .globe {
    position: relative;
    width: 300px;
    height: 300px;
    margin: 0 auto;
    border-radius: 50%;
    background: 
      radial-gradient(circle at 100px 100px, rgba(249, 115, 22, 0.1), transparent),
      linear-gradient(rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9)),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='none' stroke='rgba(249, 115, 22, 0.2)' stroke-width='1'%3E%3Cpath d='M0,400 Q200,100 400,400 T800,400'/%3E%3Cpath d='M0,450 Q200,150 400,450 T800,450'/%3E%3Cpath d='M0,500 Q200,200 400,500 T800,500'/%3E%3Cpath d='M0,350 Q200,50 400,350 T800,350'/%3E%3Cpath d='M0,300 Q200,0 400,300 T800,300'/%3E%3C/g%3E%3Cg fill='none' stroke='rgba(249, 115, 22, 0.2)' stroke-width='1'%3E%3Cpath d='M400,0 Q700,200 400,400 T400,800'/%3E%3Cpath d='M450,0 Q750,200 450,400 T450,800'/%3E%3Cpath d='M350,0 Q650,200 350,400 T350,800'/%3E%3Cpath d='M500,0 Q800,200 500,400 T500,800'/%3E%3Cpath d='M300,0 Q600,200 300,400 T300,800'/%3E%3C/g%3E%3C/svg%3E");
    box-shadow:
      inset 0 0 50px rgba(249, 115, 22, 0.2),
      0 0 30px rgba(249, 115, 22, 0.15);
    animation: rotate 60s linear infinite;
    transform-style: preserve-3d;
  }
  
  .globe::before {
    content: '';
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 50%, 
      rgba(249, 115, 22, 0.1) 0%, 
      rgba(249, 115, 22, 0.05) 40%, 
      transparent 70%);
    z-index: -1;
  }
  
  .meridian {
    position: absolute;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }
  
  .meridian:nth-child(1) { transform: rotateY(30deg); }
  .meridian:nth-child(2) { transform: rotateY(60deg); }
  .meridian:nth-child(3) { transform: rotateY(90deg); }
  .meridian:nth-child(4) { transform: rotateX(30deg); }
  .meridian:nth-child(5) { transform: rotateX(60deg); }
  .meridian:nth-child(6) { transform: rotateX(90deg); }
  
  .location-ping {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: rgba(249, 115, 22, 0.8);
    box-shadow: 0 0 10px rgba(249, 115, 22, 0.6);
    transform: translate(-50%, -50%);
    animation: ping 1.5s ease-in-out infinite;
  }
  
  @keyframes ping {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0.8;
    }
    70% {
      transform: translate(-50%, -50%) scale(1.5);
      opacity: 0.2;
    }
    100% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0.8;
    }
  }
  
  .location-ping:nth-child(1) { top: 30%; left: 70%; }
  .location-ping:nth-child(2) { top: 60%; left: 40%; }
  .location-ping:nth-child(3) { top: 40%; left: 20%; }
  
  .audio-wave {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    overflow: hidden;
  }
  
  .wave-line {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: translateZ(0);
  }
  
  .wave-line:nth-child(1) {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M0,0 C150,40 350,0 500,30 C650,60 750,20 900,40 C1050,60 1150,10 1200,30 L1200,120 L0,120 Z' fill='rgba(249, 115, 22, 0.1)'/%3E%3C/svg%3E");
    background-size: 1200px 100%;
    animation: wave-animation 12s linear infinite;
  }
  
  .wave-line:nth-child(2) {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M0,40 C150,10 350,60 500,20 C650,0 750,50 900,20 C1050,0 1150,50 1200,30 L1200,120 L0,120 Z' fill='rgba(249, 115, 22, 0.05)'/%3E%3C/svg%3E");
    background-size: 1200px 100%;
    animation: reverse-wave-animation 9s linear infinite;
  }
  
  @keyframes wave-animation {
    0% { background-position-x: 0; }
    100% { background-position-x: 1200px; }
  }
  
  @keyframes reverse-wave-animation {
    0% { background-position-x: 1200px; }
    100% { background-position-x: 0; }
  }
`;

export default function Home() {
  console.log('🏠 HOME: Component rendering');

  // Tours state
  const [tours, setTours] = useState<Tour[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTours, setTotalTours] = useState(0);
  const [toursPerPage] = useState(6);
  const [isLoadingTours, setIsLoadingTours] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Navigation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);

  // Google Maps API state
  const libraries = ['places'];
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  // PWA state
  const [showPwaTools, setShowPwaTools] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Check if we're in PWA mode
  useEffect(() => {
    setShowPwaTools(isPwa());
  }, []);

  // Functions to handle modal
  const openModal = () => {
    console.log('🔍 HOME: Opening tour creation modal');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    console.log('🔍 HOME: Closing tour creation modal');
    setIsModalOpen(false);
  };

  // Function to save a new tour
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

          // Check location properties before serializing
          const location = poi.geometry?.location;
          const latValue = location?.lat;
          const lngValue = location?.lng;

          // Log details about the current POI's location
          console.log(`📍 DEBUG LOCATION - Serializing POI "${poi.name}" location:`, {
            locationObj: location,
            latType: typeof latValue,
            lngType: typeof lngValue,
            isLatFn: typeof latValue === 'function',
            isLngFn: typeof lngValue === 'function'
          });

          // Extract location values properly
          const extractedLat = typeof latValue === 'function' ? (latValue as Function)() : latValue;
          const extractedLng = typeof lngValue === 'function' ? (lngValue as Function)() : lngValue;

          console.log(`   Location values for "${poi.name}":`, {
            lat: extractedLat,
            lng: extractedLng
          });

          // Return a cleaned POI object
          return {
            place_id: poi.place_id,
            name: poi.name,
            types: poi.types || [],
            vicinity: poi.vicinity || '',
            geometry: {
              location: {
                lat: extractedLat,
                lng: extractedLng
              }
            },
            photos: preparedPhotos,
            rating: poi.rating,
            user_ratings_total: poi.user_ratings_total,
            // Keep track of whether this is a start/end point
            is_start_or_end: poi.types.includes('starting_point') || poi.types.includes('end_point'),
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
      toast.success('Tour saved successfully!');

      // If we have valid tour data with POIs, process them with Edge Function
      if (tourData.route && tourData.route.length > 0) {
        processPOIsWithSupabase(tourData.route, data.tourId);
      }

      // Force reload tours data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('❌ HOME: Error saving tour:', error);
      toast.error(`Failed to save tour: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Process POIs with Supabase Edge Function
  const processPOIsWithSupabase = async (pois: any[], tourId: string) => {
    try {
      console.log(`🔊 HOME: Processing ${pois.length} POIs with Supabase Edge Function...`);

      const { createClient } = require('@/utils/supabase/client');
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;

      if (accessToken && pois.length > 0) {
        // Process all POIs in parallel
        const poisToProcess = pois.filter(poi => !poi.types?.includes('starting_point') && !poi.types?.includes('end_point'));
        console.log(`🎯 Processing ${poisToProcess.length} POIs in parallel`);

        // First, fetch Wikipedia & Wikivoyage content for each POI
        const poisWithExtracts = await Promise.all(
          poisToProcess.map(async (poi) => {
            try {
              // Get Wikipedia extract if available
              const wikipediaResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(poi.name)}`);
              const wikipediaData = wikipediaResponse.ok ? await wikipediaResponse.json() : null;

              return {
                ...poi,
                extraData: {
                  wikipedia: wikipediaData ? {
                    extract: wikipediaData.extract || "No Wikipedia information found.",
                    url: wikipediaData.content_urls?.desktop?.page || ""
                  } : { extract: "No Wikipedia information available." },
                  wikivoyage: { extract: "No Wikivoyage information available." }
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
          console.log(`Creating promise for POI: ${poi.name} (place_id: ${poi.place_id})`);
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
                  place_id: poi.place_id,
                  tour_id: tourId,
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
                return { poi, success: true, result };
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

        // Report summary
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Successfully processed ${successCount} of ${results.length} POIs`);

        if (successCount > 0) {
          toast.success(`Generated audio for ${successCount} points of interest`);
        } else if (results.length > 0) {
          toast.error("Failed to generate audio content");
        }
      } else {
        console.warn("⚠️ HOME: No access token or POIs available for Supabase functions");
      }
    } catch (error) {
      console.error("❌ HOME: Error with Supabase functions:", error);
      toast.error("Error processing tour content");
    }
  };

  // Handler for pagination - now properly forces a re-fetch via props
  const handlePageChange = (newPage: number) => {
    console.log(`📄 HOME: Changing to page ${newPage}`);
    setCurrentPage(newPage);
  };

  // Update the handleToursLoaded function with better debugging
  const handleToursLoaded = (loadedTours: Tour[], pagination?: { total: number, pages: number }) => {
    console.log(`✅ HOME: ${loadedTours.length} tours loaded for page ${currentPage}`);
    console.log('📊 Pagination data:', pagination);

    // Update state with the loaded tours
    setTours(loadedTours);

    // Update pagination information if provided
    if (pagination) {
      console.log(`📄 Setting totalPages=${pagination.pages}, totalTours=${pagination.total}`);
      setTotalTours(pagination.total);
      setTotalPages(pagination.pages);
    }
  };

  // Get user's current location when component mounts
  useEffect(() => {
    const requestUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
            // User declined to share location or other error
            console.log('Could not access your location');
          }
        );
      } else {
        // Browser doesn't support geolocation
        console.log('Geolocation is not supported by your browser');
      }
    };

    // Request location when component mounts
    requestUserLocation();
  }, []);

  // Reset offline data
  const handleResetOfflineData = async () => {
    if (confirm('Are you sure you want to reset all offline data? This will delete all downloaded tours.')) {
      setResetting(true);
      try {
        // Clear all IndexedDB databases
        if (window.indexedDB) {
          await window.indexedDB.deleteDatabase('offline-audio-guide');
        }

        // Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }

        // Unregister all service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(registration => registration.unregister())
          );
        }

        // Clear localStorage
        localStorage.clear();

        // Show success message
        alert('Offline data has been reset. The app will now reload.');
        
        // Reload the page
        window.location.reload();
      } catch (error) {
        console.error('Error resetting offline data:', error);
        alert('Failed to reset offline data: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <RTVIClientProvider client={client}>
      <RTVIClientAudio />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/40 to-navy-950 relative overflow-hidden">
        {/* Globe Styles */}
        <style dangerouslySetInnerHTML={{ __html: globeStyles }} />

        {/* Subtle stars background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute h-1 w-1 bg-white/70 rounded-full top-[10%] left-[15%] animate-pulse" style={{ animationDuration: '3s' }}></div>
          <div className="absolute h-1 w-1 bg-white/60 rounded-full top-[20%] left-[40%] animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute h-1 w-1 bg-white/60 rounded-full top-[15%] left-[70%] animate-pulse" style={{ animationDuration: '5s' }}></div>
          <div className="absolute h-1 w-1 bg-white/70 rounded-full top-[60%] left-[85%] animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute h-1 w-1 bg-white/60 rounded-full top-[80%] left-[20%] animate-pulse" style={{ animationDuration: '3s' }}></div>
          <div className="absolute h-[2px] w-[2px] bg-white/80 rounded-full top-[35%] left-[55%] animate-pulse" style={{ animationDuration: '2s' }}></div>
          <div className="absolute h-[2px] w-[2px] bg-white/80 rounded-full top-[75%] left-[65%] animate-pulse" style={{ animationDuration: '6s' }}></div>
        </div>

        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 bg-gradient-radial from-purple-900/5 to-transparent opacity-30"></div>

        {/* Tour data loader with currentPage and limit props */}
        <TourLoader
          onToursLoaded={handleToursLoaded}
          currentPage={currentPage}
          limit={toursPerPage}
          onLoadingChange={setIsLoadingTours}
        />

        {/* Main container */}
        <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
          {/* Hero Section with Globe */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/80 shadow-xl mb-12 border border-purple-900/50 backdrop-blur-sm">
            <div className="p-6 md:p-12 relative z-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="lg:w-1/2 text-center lg:text-left">
                  <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
                      Audio Travel Guides
                    </span>
                  </h1>

                  <p className="text-lg max-w-xl mx-auto lg:mx-0 mb-8 text-purple-100/90">
                    Explore the world through intelligent voice guides in your preferred language.
                  </p>

                  <button
                    onClick={openModal}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 rounded-lg 
                    text-white font-medium shadow-lg shadow-orange-900/30 
                    transition-all duration-300 flex items-center mx-auto lg:mx-0"
                  >
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                    Generate Audio Guide
                  </button>
                </div>

                <div className="lg:w-1/2 mt-8 lg:mt-0 perspective relative">
                  <div className="globe">
                    <div className="meridian"></div>
                    <div className="meridian"></div>
                    <div className="meridian"></div>
                    <div className="meridian"></div>
                    <div className="meridian"></div>
                    <div className="meridian"></div>

                    <div className="location-ping"></div>
                    <div className="location-ping"></div>
                    <div className="location-ping"></div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-12">
                    <div className="audio-wave">
                      <div className="wave-line"></div>
                      <div className="wave-line"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-3xl"></div>
          </div>

          {/* Tours Section */}
          <div className="bg-slate-900/80 border border-purple-900/50 rounded-xl overflow-hidden shadow-lg shadow-purple-900/20 mb-12 relative backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 absolute top-0 left-0 right-0"></div>
            <div className="absolute -right-16 -top-16 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>

            <div className="p-6 relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-orange-50 flex items-center">
                  <span className="w-1 h-6 bg-gradient-to-b from-orange-400 to-pink-500 rounded-full mr-2 inline-block"></span>
                  {tours.length > 0 ? "Your Audio Guides" : "Start Exploring"}
                </h2>
              </div>

              {tours.length === 0 ? (
                <div className="text-center py-16 px-4 bg-slate-900/50 rounded-lg border border-purple-800/50">
                  <div className="inline-block p-4 bg-orange-900/30 rounded-full mb-4">
                    <svg className="w-10 h-10 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">No Audio Guides Yet</h3>
                  <p className="text-purple-100/80 mb-6 max-w-md mx-auto">
                    Create your first personalized audio guide by selecting a location.
                  </p>
                  <button
                    onClick={openModal}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white font-medium rounded-lg
                    shadow-lg shadow-orange-900/30 transition-all duration-300"
                  >
                    Create Your First Guide
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-900/60 rounded-lg border border-purple-900/30 p-4 relative">
                    {isLoadingTours && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg z-10">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 border-4 border-t-orange-500 border-r-transparent border-b-pink-500 border-l-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-orange-300 text-sm">Loading tours...</span>
                        </div>
                      </div>
                    )}
                    <TourList tours={tours} loading={isLoadingTours} />
                  </div>

                  {/* Pagination Controls - Add loading indicator when changing pages */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 mt-4">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1 || isLoadingTours}
                        className={`px-3 py-1 rounded-md flex items-center 
                        ${(currentPage === 1 || isLoadingTours)
                            ? 'bg-slate-800/70 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-800/70 hover:bg-slate-700/70 text-white'}`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <div className="px-3 py-1 bg-slate-800/80 rounded-md text-white flex items-center">
                        {isLoadingTours ? (
                          <div className="w-4 h-4 border-2 border-t-orange-500 border-r-transparent border-b-pink-500 border-l-transparent rounded-full animate-spin mr-2"></div>
                        ) : null}
                        {currentPage} / {totalPages}
                      </div>

                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages || isLoadingTours}
                        className={`px-3 py-1 rounded-md flex items-center
                        ${(currentPage === totalPages || isLoadingTours)
                            ? 'bg-slate-800/70 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-800/70 hover:bg-slate-700/70 text-white'}`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PWA Tools */}
          {showPwaTools && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">PWA Tools</h2>
              <p className="text-sm text-blue-600 mb-3">
                These tools are available because you're using the app in PWA mode.
              </p>
              <button
                onClick={handleResetOfflineData}
                disabled={resetting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Reset Offline Data'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Use this if you're experiencing issues with offline functionality.
              </p>
            </div>
          )}
        </div>

        {/* Tour modal */}
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
    </RTVIClientProvider>
  );
} 