'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import POISelection from './POISelection';
import TourResult from './TourResult';
import { POI, TourPreferences as ApiTourPreferences, discoverPOIs } from '@/lib/places-api';

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
  'History', 'Architecture', 'Art', 'Nature', 'Food'
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

export default function TourModal({ isOpen, onClose, userLocation = DEFAULT_LOCATION, mapsApiLoaded }: TourModalProps) {
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

  // Initialize geocoder
  useEffect(() => {
    if (mapsApiLoaded && !geocoder) {
      setGeocoder(new google.maps.Geocoder());
    }
  }, [mapsApiLoaded, geocoder]);

  // Reverse geocode user location to get address when using current location
  useEffect(() => {
    if (geocoder && userLocation && preferences.startLocation.useCurrentLocation && !isGeocodingStart) {
      setIsGeocodingStart(true);
      geocoder.geocode(
        { location: userLocation },
        (results, status) => {
          setIsGeocodingStart(false);
          if (status === 'OK' && results && results.length > 0) {
            const address = results[0].formatted_address;
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
    }
  }, [geocoder, userLocation, preferences.startLocation.useCurrentLocation, isGeocodingStart, mapsApiLoaded]);

  // Reverse geocode for end location
  useEffect(() => {
    if (geocoder && userLocation && preferences.endLocation.useCurrentLocation && !isGeocodingEnd) {
      setIsGeocodingEnd(true);
      geocoder.geocode(
        { location: userLocation },
        (results, status) => {
          setIsGeocodingEnd(false);
          if (status === 'OK' && results && results.length > 0) {
            const address = results[0].formatted_address;
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
    }
  }, [geocoder, userLocation, preferences.endLocation.useCurrentLocation, isGeocodingEnd, mapsApiLoaded]);

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
      
      // Fetch POIs
      const pois = await discoverPOIs(apiPreferences);
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
  
  // Handle saving tour (placeholder for future implementation)
  const handleSaveTour = () => {
    console.log('Saving tour:', { route: tourRoute, stats: tourStats });
    // Here you would implement the save functionality
    alert('Tour saved! (placeholder)');
    onClose();
  };
  
  if (!isOpen) return null;
  
  // Determine what content to show based on current phase
  const renderModalContent = () => {
    switch (currentPhase) {
      case 'preferences':
        return (
          <form onSubmit={handleDiscoverPOIs} className="w-full">
            {discoveryError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                {discoveryError}
              </div>
            )}
          
            {/* Interests Section */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">What are you interested in?</label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS_OPTIONS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2 rounded-full text-sm transition duration-200 cursor-pointer ${
                      preferences.interests.includes(interest)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              {preferences.interests.length === 0 && (
                <p className="text-red-500 text-xs mt-1">Please select at least one interest</p>
              )}
            </div>

            {/* Start Location */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Starting Location</label>
              <div className="relative">
                {mapsApiLoaded ? (
                  <Autocomplete
                    onLoad={onStartAutocompleteLoad}
                    onPlaceChanged={onStartPlaceChanged}
                  >
                    <input
                      type="text"
                      placeholder="Enter starting location"
                      className="w-full p-2 border border-gray-300 rounded-md text-gray-700"
                      value={startAddress}
                      onChange={handleStartLocationChange}
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    placeholder="Loading autocomplete..."
                    className="w-full p-2 border border-gray-300 rounded-md text-gray-700"
                    disabled
                  />
                )}
                <button
                  type="button"
                  onClick={useCurrentLocationForStart}
                  className={`mt-2 text-sm ${
                    preferences.startLocation.useCurrentLocation
                      ? 'text-blue-600 font-medium'
                      : 'text-blue-500 hover:text-blue-700'
                  } cursor-pointer`}
                >
                  {preferences.startLocation.useCurrentLocation ? '✓ Using current location' : 'Use my current location'}
                </button>
              </div>
            </div>

            {/* End Location Options */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">End Location</label>
              <div className="mb-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.returnToStart}
                    onChange={toggleReturnToStart}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="ml-2 text-gray-700">Return to starting point</span>
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
                        className="w-full p-2 border border-gray-300 rounded-md text-gray-700"
                        value={endAddress}
                        onChange={handleEndLocationChange}
                      />
                    </Autocomplete>
                  ) : (
                    <input
                      type="text"
                      placeholder="Loading autocomplete..."
                      className="w-full p-2 border border-gray-300 rounded-md text-gray-700"
                      disabled
                    />
                  )}
                  <button
                    type="button"
                    onClick={useCurrentLocationForEnd}
                    className={`mt-2 text-sm ${
                      preferences.endLocation.useCurrentLocation
                        ? 'text-blue-600 font-medium'
                        : 'text-blue-500 hover:text-blue-700'
                    } cursor-pointer`}
                  >
                    {preferences.endLocation.useCurrentLocation ? '✓ Using current location' : 'Use my current location'}
                  </button>
                </div>
              )}
              <p className="text-gray-500 text-xs mt-2 italic">Leave blank for a one-way, free-form exploration</p>
            </div>

            {/* Duration Section */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Tour Duration (minutes)</label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateDuration(option)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 cursor-pointer ${
                      preferences.duration === option
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Distance Section */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">Distance (km)</label>
              <div className="flex gap-2">
                {DISTANCE_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateDistance(option)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 cursor-pointer ${
                      preferences.distance === option
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Transportation Mode */}
            <div className="mb-8">
              <label className="block text-gray-700 font-medium mb-2">Transportation Mode</label>
              <div className="flex gap-2">
                {TRANSPORTATION_MODES.map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => updateTransportationMode(mode.id as 'walking' | 'transit')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 cursor-pointer ${
                      preferences.transportationMode === mode.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isDiscovering ? 'Finding Points of Interest...' : 'Find Points of Interest'}
            </button>
          </form>
        );
      
      case 'poi-selection':
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
      
      case 'results':
        return (
          <TourResult 
            route={tourRoute}
            stats={tourStats}
            preferences={{
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
            onBack={handleBackToPOISelection}
            onSave={handleSaveTour}
          />
        );
    }
  };

  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 pointer-events-auto overflow-hidden max-h-[90vh] w-full max-w-5xl">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            {currentPhase === 'preferences' && 'Create Your Tour'}
            {currentPhase === 'poi-selection' && 'Select Points of Interest'}
            {currentPhase === 'results' && 'Your Personalized Tour'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 76px)' }}>
          {renderModalContent()}
        </div>
      </div>
    </div>
  );
} 