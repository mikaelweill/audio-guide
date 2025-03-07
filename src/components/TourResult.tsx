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
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours === 0) return `${mins} min`;
    return `${hours} hr ${mins} min`;
  };
  
  // Format distance
  const formatDistance = (km: number) => {
    return `${km.toFixed(1)} km`;
  };
  
  // Get marker color based on POI type
  const getMarkerColor = (poi: POI, index: number) => {
    if (index === 0) return 'green';
    if (index === route.length - 1) return 'red';
    return 'blue';
  };
  
  const handleSave = () => {
    if (onSaveTour) {
      onSaveTour();
    } else if (onSave) {
      onSave();
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mx-auto max-w-6xl">
      {/* Remove duplicate heading - we already have one in the modal header */}
      {/* <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Personalized Tour</h2> */}
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      <div className="rounded-lg overflow-hidden mb-6">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={route.length > 0 ? route[0].geometry.location : { lat: 40.7128, lng: -74.0060 }}
          zoom={14}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: true,
            mapTypeControl: true,
          }}
        >
          {/* Only show markers if directions aren't loaded yet */}
          {/* {!directions && route.map((poi, index) => (
            <MarkerF
              key={poi.place_id}
              position={poi.geometry.location}
              label={{
                text: `${index + 1}`,
                color: 'white',
              }}
              icon={{
                path: "M-1.547 12l6.563-6.609-1.406-1.406-5.156 5.203-2.063-2.109-1.406 1.406zM0 0q2.906 0 4.945 2.039t2.039 4.945q0 1.453-0.727 3.328t-1.758 3.516-2.039 3.070-1.711 2.273l-0.75 0.797q-0.281-0.328-0.75-0.867t-1.688-2.156-2.133-3.141-1.664-3.445-0.75-3.375q0-2.906 2.039-4.945t4.945-2.039z",
                fillColor: index === 0 ? '#22c55e' : (index === route.length - 1 ? '#ef4444' : '#3b82f6'),
                fillOpacity: 1,
                strokeWeight: 0,
                rotation: 0,
                scale: 2,
                anchor: new google.maps.Point(0, 20),
                labelOrigin: new google.maps.Point(0, 7),
              }}
              onClick={() => {
                if (activeStep === index) {
                  setActiveStep(-1);
                } else {
                  setActiveStep(index);
                }
              }}
            />
          ))} */}
          
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#3B82F6',
                  strokeWeight: 4,
                  strokeOpacity: 0.7,
                }
              }}
            />
          )}
          
          {/* Always show our numbered markers */}
          {route.map((poi, index) => (
            <MarkerF
              key={poi.place_id}
              position={poi.geometry.location}
              label={{
                text: `${index + 1}`,
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
              icon={{
                // Use a simpler marker path - just a circle
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: index === 0 ? '#22c55e' : (index === route.length - 1 ? '#ef4444' : '#3b82f6'),
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: 'white',
                scale: 12,
              }}
              onClick={() => {
                if (activeStep === index) {
                  setActiveStep(-1);
                } else {
                  setActiveStep(index);
                }
              }}
            />
          ))}
        </GoogleMap>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-700 mb-1">Total Distance</div>
          <div className="text-xl font-bold">{formatDistance(stats.totalWalkingDistance)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-700 mb-1">Total Duration</div>
          <div className="text-xl font-bold">{formatDuration(stats.totalTourDuration)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-700 mb-1">Points of Interest</div>
          <div className="text-xl font-bold">{stats.totalPOIs}</div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Tour Itinerary</h3>
        <div className="border rounded-lg overflow-hidden">
          {route.map((poi, index) => (
            <div
              key={poi.place_id}
              className={`border-b last:border-b-0 ${
                activeStep === index ? 'bg-blue-50' : ''
              }`}
            >
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50"
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
                    w-8 h-8 rounded-full flex items-center justify-center mr-3
                    ${index === 0 ? 'bg-green-500' : 
                      index === route.length - 1 ? 'bg-red-500' : 'bg-blue-500'}
                    text-white font-medium
                  `}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{poi.name}</h4>
                    <p className="text-gray-600 text-sm">{poi.vicinity}</p>
                  </div>
                </div>
                
                {activeStep === index && poi.details && (
                  <div className="mt-3 pl-11">
                    {poi.details.formatted_address && (
                      <p className="text-sm text-gray-600 mb-2">{poi.details.formatted_address}</p>
                    )}
                    
                    {poi.rating && (
                      <div className="flex items-center mb-2">
                        <div className="flex items-center mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-medium">
                            {poi.rating.toFixed(1)}
                          </span>
                        </div>
                        {poi.user_ratings_total && (
                          <div className="text-sm text-gray-600">
                            ({poi.user_ratings_total} reviews)
                          </div>
                        )}
                      </div>
                    )}
                    
                    {poi.details.opening_hours && (
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-700 mb-1">Hours:</div>
                        <div className="text-sm text-gray-600">
                          <span className="text-gray-600">
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
                        className="inline-block text-sm text-blue-600 hover:underline mb-2"
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
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isSaving ? 'Saving...' : 'Save Tour'}
        </button>
      </div>
    </div>
  );
} 