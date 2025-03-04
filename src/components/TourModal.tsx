'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';

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
}

// Available options
const INTERESTS_OPTIONS = [
  'History', 'Architecture', 'Art', 'Food', 
  'Nature', 'Shopping'
];

const DURATION_OPTIONS = [30, 60, 90, 120]; // in minutes
const DISTANCE_OPTIONS = [1, 2, 5, 10]; // in kilometers

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation?: {
    lat: number;
    lng: number;
  };
}

// Default to NYC if location is not available
const DEFAULT_LOCATION = {
  lat: 40.7128,
  lng: -74.0060
};

export default function TourModal({ isOpen, onClose, userLocation = DEFAULT_LOCATION }: TourModalProps) {
  // Load Google Maps script with Places library
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

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
    returnToStart: false
  });

  // Initialize geocoder
  useEffect(() => {
    if (isLoaded && !geocoder) {
      setGeocoder(new google.maps.Geocoder());
    }
  }, [isLoaded, geocoder]);

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
  }, [geocoder, userLocation, preferences.startLocation.useCurrentLocation, isGeocodingStart]);

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
  }, [geocoder, userLocation, preferences.endLocation.useCurrentLocation, isGeocodingEnd]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating tour with preferences:', preferences);
    // Here you would call your API to generate the tour
    // After tour is created, close the modal
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-50 flex items-center justify-center pointer-events-none inset-0">
      <div className="bg-white rounded-lg p-8 max-w-md w-full pointer-events-auto shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create Your Tour</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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
              {isLoaded ? (
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
                {isLoaded ? (
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
          <div className="mb-8">
            <label className="block text-gray-700 font-medium mb-2">Walking Distance (km)</label>
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={preferences.interests.length === 0}
            className={`w-full py-3 rounded-md text-white font-medium transition duration-200 cursor-pointer ${
              preferences.interests.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Generate Tour
          </button>
        </form>
      </div>
    </div>
  );
} 