'use client';

import React, { useState, useCallback, useEffect, Fragment } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import POISelection from './POISelection';
import TourResult from './TourResult';
import { POI, TourPreferences as ApiTourPreferences, discoverPOIs } from '@/lib/places-api';
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { createClient } from '@/utils/supabase/client';

// Initialize the singleton Supabase client
const supabase = createClient();

interface Location {
  address: string;
  position: {
    lat: number;
    lng: number;
  } | null;
  useCurrentLocation: boolean;
}

interface TourPreferences {
  interests: string[];
  duration: number; // in minutes
  distance: number; // in kilometers
  startLocation: Location;
  endLocation: Location;
  returnToStart: boolean;
  transportationMode: 'walking' | 'transit';
}

// Available options
const INTERESTS_OPTIONS = [
  'History', 'Architecture', 'Art', 'Nature'
];

const DURATION_OPTIONS = [30, 60, 90, 120]; // in minutes
const DISTANCE_OPTIONS = [1, 2, 5, 10]; // in kilometers
const TRANSPORTATION_MODES = [
  { id: 'walking', label: 'Walking' },
  { id: 'transit', label: 'Public Transit' }
];

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tourData: any) => void;
  userLocation?: {
    lat: number;
    lng: number;
  };
  mapsApiLoaded: boolean;
}

// Default to NYC if location is not available
const DEFAULT_LOCATION = {
  lat: 40.7128,
  lng: -74.0060
};

// Tour generation phases
type Phase = 'preferences' | 'poi-selection' | 'results';

export default function TourModal({ isOpen, onClose, onSave, userLocation = DEFAULT_LOCATION, mapsApiLoaded }: TourModalProps) {
  console.log("⭐⭐⭐ TOUR MODAL COMPONENT LOADED - NEW VERSION ⭐⭐⭐");

  // Current phase of tour generation
  const [currentPhase, setCurrentPhase] = useState<Phase>('preferences');
  
  // Discovery results
  const [discoveredPOIs, setDiscoveredPOIs] = useState<POI[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  
  // Tour results
  const [tourRoute, setTourRoute] = useState<POI[]>([]);
  const [tourStats, setTourStats] = useState<any>(null);
  
  const [autocompleteStart, setAutocompleteStart] = useState<google.maps.places.Autocomplete | null>(null);
  const [autocompleteEnd, setAutocompleteEnd] = useState<google.maps.places.Autocomplete | null>(null);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [startAddress, setStartAddress] = useState<string>('');
  const [endAddress, setEndAddress] = useState<string>('');
  const [isGeocodingStart, setIsGeocodingStart] = useState<boolean>(false);
  const [isGeocodingEnd, setIsGeocodingEnd] = useState<boolean>(false);
  // Add a geocoding cache to prevent duplicate API calls
  const [geocodingCache, setGeocodingCache] = useState<Record<string, string>>({});

  const [preferences, setPreferences] = useState<TourPreferences>({
    interests: [],
    duration: 60,
    distance: 2,
    startLocation: {
      address: '',
      position: null,
      useCurrentLocation: true
    },
    endLocation: {
      address: '',
      position: null,
      useCurrentLocation: false
    },
    returnToStart: false,
    transportationMode: 'walking'
  });

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Form data for tour details
  const [formData, setFormData] = useState({
    tourName: '',
    tourDescription: ''
  });

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentPhase('preferences');
      setDiscoveredPOIs([]);
      setTourRoute([]);
      setTourStats(null);
      setDiscoveryError(null);
    }
  }, [isOpen]);

  // Initialize geocoder only when the modal is open
  useEffect(() => {
    if (isOpen && mapsApiLoaded && !geocoder) {
      setGeocoder(new google.maps.Geocoder());
    }
  }, [isOpen, mapsApiLoaded, geocoder]);

  // Helper function to get cached geocoding results
  const getCachedGeocodingResult = (location: google.maps.LatLng | google.maps.LatLngLiteral): string | null => {
    // Cast lat/lng to number before using toFixed
    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
    const locationKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    return geocodingCache[locationKey] || null;
  };

  // Helper function to cache geocoding results
  const cacheGeocodingResult = (location: google.maps.LatLng | google.maps.LatLngLiteral, address: string): void => {
    // Cast lat/lng to number before using toFixed
    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
    const locationKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    setGeocodingCache(prev => ({
      ...prev,
      [locationKey]: address
    }));
  };

  // Reverse geocode user location to get address when using current location - with cache check
  useEffect(() => {
    if (!isOpen || !geocoder || !userLocation || !preferences.startLocation.useCurrentLocation || isGeocodingStart) {
      return;
    }
    
    // Check cache first
    const cachedAddress = getCachedGeocodingResult(userLocation);
    if (cachedAddress) {
      setStartAddress(cachedAddress);
      setPreferences(prev => ({
        ...prev,
        startLocation: {
          ...prev.startLocation,
          address: cachedAddress,
          position: userLocation
        }
      }));
      return;
    }
    
    // If not in cache, perform geocoding
    setIsGeocodingStart(true);
    geocoder.geocode(
      { location: userLocation },
      (results, status) => {
        setIsGeocodingStart(false);
        if (status === 'OK' && results && results.length > 0) {
          const address = results[0].formatted_address;
          // Cache the result
          cacheGeocodingResult(userLocation, address);
          
          setStartAddress(address);
          setPreferences(prev => ({
            ...prev,
            startLocation: {
              ...prev.startLocation,
              address: address,
              position: userLocation
            }
          }));
        } else {
          setStartAddress('Current Location');
        }
      }
    );
  }, [geocoder, userLocation, preferences.startLocation.useCurrentLocation, isGeocodingStart, isOpen]);

  // Reverse geocode for end location - with cache check
  useEffect(() => {
    if (!isOpen || !geocoder || !userLocation || !preferences.endLocation.useCurrentLocation || isGeocodingEnd) {
      return;
    }
    
    // Check cache first
    const cachedAddress = getCachedGeocodingResult(userLocation);
    if (cachedAddress) {
      setEndAddress(cachedAddress);
      setPreferences(prev => ({
        ...prev,
        endLocation: {
          ...prev.endLocation,
          address: cachedAddress,
          position: userLocation
        }
      }));
      return;
    }
    
    // If not in cache, perform geocoding
    setIsGeocodingEnd(true);
    geocoder.geocode(
      { location: userLocation },
      (results, status) => {
        setIsGeocodingEnd(false);
        if (status === 'OK' && results && results.length > 0) {
          const address = results[0].formatted_address;
          // Cache the result
          cacheGeocodingResult(userLocation, address);
          
          setEndAddress(address);
          setPreferences(prev => ({
            ...prev,
            endLocation: {
              ...prev.endLocation,
              address: address,
              position: userLocation
            }
          }));
        } else {
          setEndAddress('Current Location');
        }
      }
    );
  }, [geocoder, userLocation, preferences.endLocation.useCurrentLocation, isGeocodingEnd, isOpen]);

  // Update location preferences when user location changes
  useEffect(() => {
    if (preferences.startLocation.useCurrentLocation) {
      setPreferences(prev => ({
        ...prev,
        startLocation: {
          ...prev.startLocation,
          position: userLocation
        }
      }));
    }
    
    if (preferences.endLocation.useCurrentLocation) {
      setPreferences(prev => ({
        ...prev,
        endLocation: {
          ...prev.endLocation,
          position: userLocation
        }
      }));
    }
  }, [userLocation, preferences.startLocation.useCurrentLocation, preferences.endLocation.useCurrentLocation]);

  const toggleInterest = (interest: string) => {
    setPreferences(prev => {
      if (prev.interests.includes(interest)) {
        return {
          ...prev,
          interests: prev.interests.filter(i => i !== interest)
        };
      } else {
        return {
          ...prev,
          interests: [...prev.interests, interest]
        };
      }
    });
  };

  const updateDuration = (duration: number) => {
    setPreferences(prev => ({
      ...prev,
      duration
    }));
  };

  const updateDistance = (distance: number) => {
    setPreferences(prev => ({
      ...prev,
      distance
    }));
  };
  
  const updateTransportationMode = (mode: 'walking' | 'transit') => {
    setPreferences(prev => ({
      ...prev,
      transportationMode: mode
    }));
  };

  // Handle autocomplete loading
  const onStartAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    setAutocompleteStart(autocomplete);
  }, []);

  const onEndAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    setAutocompleteEnd(autocomplete);
  }, []);

  // Handle place selection
  const onStartPlaceChanged = useCallback(() => {
    if (autocompleteStart) {
      const place = autocompleteStart.getPlace();
      
      if (place.geometry?.location) {
        setPreferences(prev => ({
          ...prev,
          startLocation: {
            address: place.formatted_address || '',
            position: {
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng(),
            },
            useCurrentLocation: false
          }
        }));
        setStartAddress(place.formatted_address || '');
      }
    }
  }, [autocompleteStart]);

  const onEndPlaceChanged = useCallback(() => {
    if (autocompleteEnd) {
      const place = autocompleteEnd.getPlace();
      
      if (place.geometry?.location) {
        setPreferences(prev => ({
          ...prev,
          endLocation: {
            address: place.formatted_address || '',
            position: {
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng(),
            },
            useCurrentLocation: false
          }
        }));
        setEndAddress(place.formatted_address || '');
      }
    }
  }, [autocompleteEnd]);

  // Set location to current user location
  const useCurrentLocationForStart = () => {
    setPreferences(prev => ({
      ...prev,
      startLocation: {
        address: startAddress || 'Current Location',
        position: userLocation,
        useCurrentLocation: true
      }
    }));
  };

  const useCurrentLocationForEnd = () => {
    setPreferences(prev => ({
      ...prev,
      endLocation: {
        address: endAddress || 'Current Location',
        position: userLocation,
        useCurrentLocation: true
      }
    }));
  };

  // Handle user editing location inputs
  const handleStartLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartAddress(value);
    
    // If user is typing, consider it as a custom location
    if (preferences.startLocation.useCurrentLocation) {
      setPreferences(prev => ({
        ...prev,
        startLocation: {
          ...prev.startLocation,
          address: value,
          useCurrentLocation: false
        }
      }));
    } else {
      setPreferences(prev => ({
        ...prev,
        startLocation: {
          ...prev.startLocation,
          address: value
        }
      }));
    }
  };

  const handleEndLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndAddress(value);
    
    // If user is typing, consider it as a custom location
    if (preferences.endLocation.useCurrentLocation) {
      setPreferences(prev => ({
        ...prev,
        endLocation: {
          ...prev.endLocation,
          address: value,
          useCurrentLocation: false
        }
      }));
    } else {
      setPreferences(prev => ({
        ...prev,
        endLocation: {
          ...prev.endLocation,
          address: value
        }
      }));
    }
  };

  // Toggle return to start option
  const toggleReturnToStart = () => {
    setPreferences(prev => ({
      ...prev,
      returnToStart: !prev.returnToStart,
      // If returnToStart is enabled, clear end location
      endLocation: !prev.returnToStart ? {
        address: '',
        position: null,
        useCurrentLocation: false
      } : prev.endLocation
    }));
  };

  // Start POI discovery
  const handleDiscoverPOIs = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate preferences
    if (preferences.interests.length === 0) {
      return; // Form already shows error
    }
    
    // Ensure start location is set
    if (!preferences.startLocation.position) {
      setDiscoveryError('Please set a valid starting location.');
      return;
    }
    
    // Ensure end location is set if not returning to start
    if (!preferences.returnToStart && !preferences.endLocation.position) {
      setDiscoveryError('Please set a valid end location or choose to return to start.');
      return;
    }
    
    setIsDiscovering(true);
    setDiscoveryError(null);
    
    try {
      // Convert our preferences to the API format
      const apiPreferences: ApiTourPreferences = {
        interests: preferences.interests,
        duration: preferences.duration,
        distance: preferences.distance,
        startLocation: {
          position: preferences.startLocation.position!,
          address: preferences.startLocation.address,
        },
        endLocation: {
          position: preferences.endLocation.position || preferences.startLocation.position!,
          address: preferences.endLocation.address || preferences.startLocation.address,
        },
        returnToStart: preferences.returnToStart,
        transportationMode: preferences.transportationMode
      };
      
      // REPLACED: Instead of using fetch to a non-existent API, call the function directly
      console.log('Calling discoverPOIs with maxResults limit of 3...');
      const pois = await discoverPOIs(apiPreferences, { maxResults: 3 });
      
      // Log POIs to check if they have website data
      console.log('Discovered POIs:', pois.map(poi => ({
        name: poi.name,
        has_details: !!poi.details,
        has_website: poi.details?.website ? true : false,
        website_url: poi.details?.website,
        has_photos: !!(poi.photos && poi.photos.length > 0),
        photos: poi.photos 
      })));
      
      // Make sure we're preserving the complete POI objects with photos
      setDiscoveredPOIs(pois);
      
      // Move to next phase
      setCurrentPhase('poi-selection');
    } catch (error) {
      console.error('Error discovering POIs:', error);
      setDiscoveryError('Failed to discover points of interest. Please try again.');
    } finally {
      setIsDiscovering(false);
    }
  };
  
  // Handle tour generation from selected POIs
  const handleGenerateTour = (route: POI[], stats: any) => {
    setTourRoute(route);
    setTourStats(stats);
    setCurrentPhase('results');
  };
  
  // Handle back button from POI selection
  const handleBackToPreferences = () => {
    setCurrentPhase('preferences');
  };
  
  // Handle back button from results
  const handleBackToPOISelection = () => {
    setCurrentPhase('poi-selection');
  };
  
  // Replace the complex saveWithSupabaseFunction with a simple function that prepares data
  const prepareDataForSave = () => {
    console.log("🔄 Preparing tour data for saving...");
    
    // Extract all tour data first (no async operations)
    const tourName = formData.tourName || `Tour near ${preferences.startLocation.address}`;
    
    // Extract route data keeping ALL POIs including start/end points
    // Previously we were filtering out start/end points which caused maps to show incomplete routes
    const simplifiedRoute = tourRoute.map(poi => {
      // Special handling for start/end points to retain them in the saved tour
      const isStartOrEnd = poi.types.includes('starting_point') || poi.types.includes('end_point');
      
      console.log(`Processing POI for saving: ${poi.name} (${isStartOrEnd ? 'start/end point' : 'regular POI'})`);
      
      return {
        place_id: poi.place_id,
        name: poi.name,
        types: poi.types || [],
        vicinity: poi.vicinity || '',
        geometry: poi.geometry,
        rating: isStartOrEnd ? undefined : poi.rating,
        photos: isStartOrEnd ? undefined : poi.photos,
        details: isStartOrEnd ? undefined : poi.details
      };
    });
    
    // Log location data for the route being saved
    console.log("📍 DEBUG LOCATION - Tour route data for saving:", 
      simplifiedRoute.map(poi => {
        const location = poi.geometry?.location;
        const latValue = location?.lat;
        const lngValue = location?.lng;
        
        return {
          name: poi.name,
          vicinity: poi.vicinity, // Log the address info stored in vicinity
          isStartOrEnd: poi.types.includes('starting_point') || poi.types.includes('end_point'),
          latType: typeof latValue,
          lngType: typeof lngValue,
          isLatFn: typeof latValue === 'function',
          isLngFn: typeof lngValue === 'function',
          lat: typeof latValue === 'function' ? 
            (latValue as Function)() : latValue,
          lng: typeof lngValue === 'function' ? 
            (lngValue as Function)() : lngValue
        };
      })
    );
    
    // Prepare the preferences in the expected format
    const apiPreferences = {
      interests: preferences.interests,
      duration: preferences.duration,
      distance: preferences.distance,
      startLocation: {
        position: preferences.startLocation.position || userLocation,
        address: preferences.startLocation.address,
        useCurrentLocation: preferences.startLocation.useCurrentLocation
      },
      endLocation: {
        position: preferences.endLocation.position || userLocation,
        address: preferences.endLocation.address,
        useCurrentLocation: preferences.endLocation.useCurrentLocation
      },
      returnToStart: preferences.returnToStart,
      transportationMode: preferences.transportationMode
    };
    
    // Prepare API request payload
    const payload = {
      name: tourName,
      description: formData.tourDescription || '',
      route: simplifiedRoute,
      preferences: apiPreferences,
      stats: tourStats
    };

    return payload;
  };

  // Replace handleSaveTour to use the new onSave prop
  const handleSaveTour = () => {
    setIsSaving(true);
    
    try {
      // Prepare the data
      const tourData = prepareDataForSave();
      
      // Pass data to parent component and let it handle saving
      onSave(tourData);
    } catch (error) {
      console.error("Error preparing tour data:", error);
      
      // Show error with DOM if needed
      const errorNotification = document.createElement('div');
      errorNotification.style.position = 'fixed';
      errorNotification.style.bottom = '20px';
      errorNotification.style.right = '20px';
      errorNotification.style.backgroundColor = '#EF4444';
      errorNotification.style.color = 'white';
      errorNotification.style.padding = '12px 24px';
      errorNotification.style.borderRadius = '8px';
      errorNotification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      errorNotification.style.zIndex = '9999';
      errorNotification.textContent = `Failed to prepare tour data: ${error instanceof Error ? error.message : 'Unknown error'}`;
      document.body.appendChild(errorNotification);
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        try {
          document.body.removeChild(errorNotification);
        } catch (e) {
          // Ignore if already removed
        }
      }, 5000);
    } finally {
      // No need to reset isSaving as the component will be unmounted when modal closes
    }
  };
  
  if (!isOpen) return null;
  
  // Determine what content to show based on current phase
  const renderModalContent = () => {
    if (currentPhase === 'preferences') {
      return (
        <form onSubmit={handleDiscoverPOIs} className="w-full">
          {discoveryError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {discoveryError}
            </div>
          )}
        
          {/* Interests Section */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">What are you interested in?</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS_OPTIONS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-2 rounded-full text-sm transition duration-200 cursor-pointer ${
                    preferences.interests.includes(interest)
                      ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow-md'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-purple-900/20'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            {preferences.interests.length === 0 && (
              <p className="text-pink-400 text-xs mt-1">Please select at least one interest</p>
            )}
          </div>

          {/* Start Location */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">Starting Location</label>
            <div className="relative">
              {mapsApiLoaded ? (
                <Autocomplete
                  onLoad={onStartAutocompleteLoad}
                  onPlaceChanged={onStartPlaceChanged}
                >
                  <input
                    type="text"
                    placeholder="Enter starting location"
                    className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md text-white placeholder-gray-400"
                    value={startAddress}
                    onChange={handleStartLocationChange}
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  placeholder="Loading autocomplete..."
                  className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md text-white placeholder-gray-400"
                  disabled
                />
              )}
              <button
                type="button"
                onClick={useCurrentLocationForStart}
                className={`mt-2 text-sm ${
                  preferences.startLocation.useCurrentLocation
                    ? 'text-pink-400 font-medium'
                    : 'text-pink-400 hover:text-pink-300'
                } cursor-pointer`}
              >
                {preferences.startLocation.useCurrentLocation ? '✓ Using current location' : 'Use my current location'}
              </button>
            </div>
          </div>

          {/* End Location Options */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">End Location</label>
            <div className="mb-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.returnToStart}
                  onChange={toggleReturnToStart}
                  className="h-4 w-4 text-pink-500 border-slate-700 bg-slate-800 rounded cursor-pointer focus:ring-pink-500 focus:ring-opacity-50"
                />
                <span className="ml-2 text-white">Return to starting point</span>
              </label>
            </div>

            {!preferences.returnToStart && (
              <div className="relative">
                {mapsApiLoaded ? (
                  <Autocomplete
                    onLoad={onEndAutocompleteLoad}
                    onPlaceChanged={onEndPlaceChanged}
                  >
                    <input
                      type="text"
                      placeholder="Enter end location"
                      className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md text-white placeholder-gray-400"
                      value={endAddress}
                      onChange={handleEndLocationChange}
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    placeholder="Loading autocomplete..."
                    className="w-full p-2 border border-slate-700 bg-slate-800 rounded-md text-white placeholder-gray-400"
                    disabled
                  />
                )}
                <button
                  type="button"
                  onClick={useCurrentLocationForEnd}
                  className={`mt-2 text-sm ${
                    preferences.endLocation.useCurrentLocation
                      ? 'text-pink-400 font-medium'
                      : 'text-pink-400 hover:text-pink-300'
                  } cursor-pointer`}
                >
                  {preferences.endLocation.useCurrentLocation ? '✓ Using current location' : 'Use my current location'}
                </button>
              </div>
            )}
            <p className="text-gray-400 text-xs mt-2 italic">Leave blank for a one-way, free-form exploration</p>
          </div>

          {/* Duration Section */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">Tour Duration (minutes)</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateDuration(option)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 cursor-pointer ${
                    preferences.duration === option
                      ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow-md'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-purple-900/20'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Section */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2">Distance (km)</label>
            <div className="flex gap-2">
              {DISTANCE_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateDistance(option)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 cursor-pointer ${
                    preferences.distance === option
                      ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow-md'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-purple-900/20'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          
          {/* Transportation Mode */}
          <div className="mb-8">
            <label className="block text-white font-medium mb-2">Transportation Mode</label>
            <div className="flex gap-2">
              {TRANSPORTATION_MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateTransportationMode(mode.id as 'walking' | 'transit')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 cursor-pointer ${
                    preferences.transportationMode === mode.id
                      ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow-md'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-purple-900/20'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Find POIs Button */}
          <button
            type="submit"
            disabled={preferences.interests.length === 0 || isDiscovering}
            className={`w-full py-3 rounded-md text-white font-medium transition duration-200 cursor-pointer ${
              preferences.interests.length === 0 || isDiscovering
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 hover:opacity-90 shadow-md'
            }`}
          >
            {isDiscovering ? 'Finding Points of Interest...' : 'Find Points of Interest'}
          </button>
        </form>
      );
    }
    
    if (currentPhase === 'poi-selection') {
      return (
        <POISelection 
          pois={discoveredPOIs}
          tourPreferences={{
            interests: preferences.interests,
            duration: preferences.duration,
            distance: preferences.distance,
            startLocation: {
              position: preferences.startLocation.position!,
              address: preferences.startLocation.address,
            },
            endLocation: {
              position: preferences.endLocation.position || preferences.startLocation.position!,
              address: preferences.endLocation.address || preferences.startLocation.address,
            },
            returnToStart: preferences.returnToStart,
            transportationMode: preferences.transportationMode
          }}
          onGenerateTour={handleGenerateTour}
          onBack={handleBackToPreferences}
        />
      );
    }
    
    if (currentPhase === 'results') {
      return (
        <TourResult
          route={tourRoute}
          stats={tourStats}
          preferences={{
            interests: preferences.interests,
            duration: preferences.duration,
            distance: preferences.distance,
            startLocation: {
              position: preferences.startLocation.position || userLocation,
              address: preferences.startLocation.address,
            },
            endLocation: {
              position: preferences.endLocation.position || preferences.startLocation.position || userLocation,
              address: preferences.endLocation.address || preferences.startLocation.address,
            },
            returnToStart: preferences.returnToStart,
            transportationMode: preferences.transportationMode
          }}
          onBack={handleBackToPOISelection}
          onSaveTour={handleSaveTour}
          isSaving={isSaving}
          formData={formData}
          setFormData={setFormData}
        />
      );
    }
    
    return null;
  };

  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-slate-900 rounded-lg shadow-2xl border border-purple-900/30 pointer-events-auto overflow-hidden max-h-[90vh] w-full max-w-5xl">
        <div className="flex justify-between items-center p-6 border-b border-purple-900/30 bg-gradient-to-r from-purple-900/50 via-slate-900 to-slate-900">
          <h2 className="text-2xl font-bold text-white">
            {currentPhase === 'preferences' && 'Create Your Tour'}
            {currentPhase === 'poi-selection' && 'Select Points of Interest'}
            {currentPhase === 'results' && 'Your Personalized Tour'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-300 hover:text-pink-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950" style={{ maxHeight: 'calc(90vh - 76px)' }}>
          {renderModalContent()}
        </div>
      </div>
    </div>
  );
} 