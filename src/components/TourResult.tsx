'use client';

import { useState } from 'react';
import { POI, TourPreferences } from '@/lib/places-api';
import { GoogleMap, MarkerF, DirectionsRenderer } from '@react-google-maps/api';

interface TourResultProps {
  route: POI[];
  stats: any;
  preferences?: TourPreferences;
  onBack: () => void;
  onSave?: () => void;
  onSaveTour?: () => void;
  isSaving?: boolean;
  formData?: any;
  setFormData?: (data: any) => void;
}

export default function TourResult({ 
  route, 
  stats, 
  preferences, 
  onBack, 
  onSave, 
  onSaveTour,
  isSaving = false,
  formData = {},
  setFormData = () => {}
}: TourResultProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Map settings
  const mapContainerStyle = {
    width: '100%',
    height: '400px',
  };
  
  // Auto-fit map when it loads
  const onMapLoad = (map: google.maps.Map) => {
    // Create bounds object to contain all points
    const bounds = new google.maps.LatLngBounds();
    
    // Add all POI locations to the bounds
    route.forEach(poi => {
      bounds.extend(poi.geometry.location);
    });
    
    // Fit the map to the bounds
    map.fitBounds(bounds);
    
    // Add a small padding for better visibility
    const padding = { top: 50, right: 50, bottom: 50, left: 50 };
    map.fitBounds(bounds, padding);
    
    // Load directions
    if (route.length <= 1) return;
    
    const directionsService = new google.maps.DirectionsService();
    
    // Filter out the actual POIs (exclude start/end)
    const poiPoints = route.filter(poi => 
      !poi.types.includes('starting_point') && 
      !poi.types.includes('end_point')
    );
    
    // If we only have start and end points
    if (poiPoints.length === 0) {
      directionsService.route(
        {
          origin: route[0].geometry.location,
          destination: route[route.length - 1].geometry.location,
          travelMode: google.maps.TravelMode.WALKING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
          } else {
            setError(`Directions request failed: ${status}`);
          }
        }
      );
      return;
    }
    
    // Create waypoints for the POIs
    const waypoints = poiPoints.map(poi => ({
      location: poi.geometry.location,
      stopover: true
    }));
    
    // Request directions
    directionsService.route(
      {
        origin: route[0].geometry.location,
        destination: route[route.length - 1].geometry.location,
        waypoints,
        optimizeWaypoints: false, // We've already optimized the route
        travelMode: preferences?.transportationMode === 'transit' 
          ? google.maps.TravelMode.TRANSIT 
          : google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          setError(`Directions request failed: ${status}`);
        }
      }
    );
  };
  
  // Format duration
  const formatDuration = (minutes: number) => {
    console.log(`🕒 DEBUG ETA: Formatting duration from raw value: ${minutes} minutes`);
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    // Ensure a minimum display time if the value is very small but not zero
    const formattedResult = hours === 0 
      ? `${Math.max(mins, minutes > 0 ? 1 : 0)} min` 
      : `${hours} hr ${mins} min`;
      
    console.log(`🕒 DEBUG ETA: Formatted result: ${formattedResult}`);
    return formattedResult;
  };
  
  // Format distance
  const formatDistance = (km: number) => {
    return `${km.toFixed(1)} km`;
  };
  
  // Get marker color based on POI type
  const getMarkerColor = (poi: POI, index: number) => {
    if (index === 0) return '#10b981'; // green-500
    if (index === route.length - 1) return '#f43f5e'; // rose-500
    return '#f97316'; // orange-500
  };
  
  // Add validation for form fields
  const [formErrors, setFormErrors] = useState({
    name: false,
    description: false
  });
  
  const handleSave = () => {
    // Validate form fields - only name is required
    const errors = {
      name: !formData.tourName?.trim(),
      description: false // Description is now optional
    };
    
    setFormErrors(errors);
    
    // If name is valid, proceed with save
    if (!errors.name) {
      if (onSaveTour) {
        onSaveTour();
      } else if (onSave) {
        onSave();
      }
    } else {
      // Scroll to the form section
      document.getElementById('tour-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <div className="bg-slate-900 rounded-lg shadow-md p-6 mx-auto max-w-6xl border border-purple-900/30">
      {/* Tour Name and Description */}
      <div id="tour-form" className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3">Save Your Tour</h3>
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Tour Name <span className="text-pink-500">*</span>
          </label>
          <input
            type="text"
            value={formData.tourName || ''}
            onChange={(e) => setFormData({ ...formData, tourName: e.target.value })}
            placeholder={`Tour near ${preferences?.startLocation.address || 'your location'}`}
            className={`w-full p-2 border ${formErrors.name ? 'border-pink-500' : 'border-slate-700'} bg-slate-800 rounded-md text-white placeholder-gray-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500`}
          />
          {formErrors.name && (
            <p className="text-pink-500 text-xs mt-1">Please enter a name for your tour</p>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add notes about this tour (optional)"
            className={`w-full p-2 border ${formErrors.description ? 'border-pink-500' : 'border-slate-700'} bg-slate-800 rounded-md text-white placeholder-gray-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500`}
            rows={2}
          />
          {formErrors.description && (
            <p className="text-pink-500 text-xs mt-1">Please enter a description for your tour</p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 rounded-md border border-red-800/50">
          {error}
        </div>
      )}
      
      <div className="mb-6 rounded-lg overflow-hidden border border-purple-900/30">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={route.length > 0 ? route[0].geometry.location : { lat: 40.7128, lng: -74.0060 }}
          zoom={14}
          onLoad={onMapLoad}
          options={{
            styles: [
              {
                "elementType": "geometry",
                "stylers": [{ "color": "#242f3e" }]
              },
              {
                "elementType": "labels.text.stroke",
                "stylers": [{ "color": "#242f3e" }]
              },
              {
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#746855" }]
              },
              {
                "featureType": "administrative.locality",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#d59563" }]
              },
              {
                "featureType": "poi",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#d59563" }]
              },
              {
                "featureType": "poi.park",
                "elementType": "geometry",
                "stylers": [{ "color": "#263c3f" }]
              },
              {
                "featureType": "poi.park",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#6b9a76" }]
              },
              {
                "featureType": "road",
                "elementType": "geometry",
                "stylers": [{ "color": "#38414e" }]
              },
              {
                "featureType": "road",
                "elementType": "geometry.stroke",
                "stylers": [{ "color": "#212a37" }]
              },
              {
                "featureType": "road",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#9ca5b3" }]
              },
              {
                "featureType": "road.highway",
                "elementType": "geometry",
                "stylers": [{ "color": "#746855" }]
              },
              {
                "featureType": "road.highway",
                "elementType": "geometry.stroke",
                "stylers": [{ "color": "#1f2835" }]
              },
              {
                "featureType": "road.highway",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#f3d19c" }]
              },
              {
                "featureType": "transit",
                "elementType": "geometry",
                "stylers": [{ "color": "#2f3948" }]
              },
              {
                "featureType": "transit.station",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#d59563" }]
              },
              {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{ "color": "#17263c" }]
              },
              {
                "featureType": "water",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#515c6d" }]
              },
              {
                "featureType": "water",
                "elementType": "labels.text.stroke",
                "stylers": [{ "color": "#17263c" }]
              }
            ]
          }}
        >
          {directions && (
            <DirectionsRenderer 
              directions={directions}
              options={{ 
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#f97316', // orange-500
                  strokeOpacity: 0.8,
                  strokeWeight: 5
                }
              }}
            />
          )}
          
          {route.map((poi, index) => (
            <MarkerF 
              key={poi.place_id}
              position={poi.geometry.location}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: getMarkerColor(poi, index),
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#fff',
                scale: 8,
              }}
            />
          ))}
        </GoogleMap>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-900/30 to-slate-800 p-4 rounded-lg border border-purple-900/30">
          <div className="text-sm text-purple-300 mb-1">Total Distance</div>
          <div className="text-xl font-bold text-white">{formatDistance(stats.totalWalkingDistance)}</div>
        </div>
        <div className="bg-gradient-to-br from-pink-900/30 to-slate-800 p-4 rounded-lg border border-purple-900/30">
          <div className="text-sm text-pink-300 mb-1">Total Duration</div>
          <div className="text-xl font-bold text-white">{formatDuration(stats.totalTourDuration)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-900/30 to-slate-800 p-4 rounded-lg border border-purple-900/30">
          <div className="text-sm text-orange-300 mb-1">Points of Interest</div>
          <div className="text-xl font-bold text-white">{stats.totalPOIs}</div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-3">Tour Itinerary</h3>
        <div className="border border-purple-900/30 rounded-lg overflow-hidden bg-slate-800/50">
          {route.map((poi, index) => (
            <div
              key={poi.place_id}
              className={`border-b border-purple-900/20 last:border-b-0 ${
                activeStep === index ? 'bg-slate-700/50' : ''
              }`}
            >
              <div 
                className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors duration-200"
                onClick={() => {
                  if (activeStep === index) {
                    // If this step is already active, close it
                    setActiveStep(-1);
                  } else {
                    // Otherwise, open it
                    setActiveStep(index);
                  }
                }}
              >
                <div className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center mr-3 shadow-md
                    ${index === 0 ? 'bg-gradient-to-r from-green-500 to-green-600' : 
                      index === route.length - 1 ? 'bg-gradient-to-r from-red-500 to-pink-600' : 
                      'bg-gradient-to-r from-orange-500 to-pink-600'}
                    text-white font-medium
                  `}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{poi.name}</h4>
                    <p className="text-gray-300 text-sm">{poi.vicinity}</p>
                  </div>
                </div>
                
                {activeStep === index && poi.details && (
                  <div className="mt-3 pl-11">
                    {poi.details.formatted_address && (
                      <p className="text-sm text-gray-300 mb-2">{poi.details.formatted_address}</p>
                    )}
                    
                    {poi.rating && (
                      <div className="flex items-center mb-2">
                        <div className="flex items-center mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-200">
                            {poi.rating.toFixed(1)}
                          </span>
                        </div>
                        {poi.user_ratings_total && (
                          <div className="text-sm text-gray-400">
                            ({poi.user_ratings_total} reviews)
                          </div>
                        )}
                      </div>
                    )}
                    
                    {poi.details.opening_hours && (
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-200 mb-1">Hours:</div>
                        <div className="text-sm text-gray-300">
                          <span>
                            {poi.details.opening_hours.weekday_text && 
                             poi.details.opening_hours.weekday_text.length > 0 ? 
                              poi.details.opening_hours.weekday_text[0] : 
                              'Hours information available'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {poi.details.website && (
                      <a 
                        href={poi.details.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block text-sm text-pink-400 hover:text-pink-300 transition-colors duration-200 mb-2"
                      >
                        Visit website
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-purple-900/30 rounded-md text-gray-300 hover:bg-slate-800 transition-colors duration-200 focus:outline-none"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 rounded-md text-white hover:opacity-90 shadow-md transition-opacity duration-200 focus:outline-none"
        >
          {isSaving ? 'Saving...' : 'Save Tour'}
        </button>
      </div>
    </div>
  );
} 