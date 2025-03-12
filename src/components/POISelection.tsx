'use client';

import { useState, useEffect } from 'react';
import { POI, TourPreferences, generateTourRoute } from '@/lib/places-api';
import Image from 'next/image';

interface POISelectionProps {
  pois: POI[];
  tourPreferences: TourPreferences;
  onGenerateTour: (route: POI[], stats: any) => void;
  onBack: () => void;
}

export default function POISelection({ pois, tourPreferences, onGenerateTour, onBack }: POISelectionProps) {
  const [selectedPOIs, setSelectedPOIs] = useState<POI[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate recommended POI count based on tour preferences
  const calculateRecommendedCount = (duration: number): number => {
    // Adaptive timing based on tour duration
    let timePerPOI: number;
    let walkingTime: number;
    let bufferPercentage: number;
    
    if (duration <= 60) {
      // For shorter tours, allocate less time per POI
      timePerPOI = 12; // minutes
      walkingTime = 6; // minutes
      bufferPercentage = 0.1; // 10% buffer
    } else if (duration <= 90) {
      // Medium tours
      timePerPOI = 15; // minutes
      walkingTime = 8; // minutes
      bufferPercentage = 0.15; // 15% buffer
    } else {
      // Longer tours
      timePerPOI = 20; // minutes
      walkingTime = 10; // minutes
      bufferPercentage = 0.2; // 20% buffer
    }
    
    const totalTravelTime = duration - (duration * bufferPercentage);
    return Math.max(2, Math.floor(totalTravelTime / (timePerPOI + walkingTime)));
  };

  const recommendedCount = calculateRecommendedCount(tourPreferences.duration);
  
  // Add a debug function to log photo details
  const logPOIPhotoDetails = (poi: POI) => {
    console.log(`📸 DEBUG: POI ${poi.name} photo data:`, 
      poi.photos ? poi.photos.map(photo => ({
        photo_reference: photo.photo_reference,
        hasGetUrl: 'getUrl' in photo,
        width: photo.width,
        height: photo.height,
        attributionsCount: photo.html_attributions?.length || 0
      })) : 'No photos'
    );
  };
  
  const togglePOISelection = (poi: POI) => {
    // Log photo details for debugging
    logPOIPhotoDetails(poi);
    
    if (selectedPOIs.some(p => p.place_id === poi.place_id)) {
      setSelectedPOIs(selectedPOIs.filter(p => p.place_id !== poi.place_id));
    } else {
      setSelectedPOIs([...selectedPOIs, poi]);
    }
  };
  
  // Generate tour with selected POIs
  const handleGenerateTour = async () => {
    if (selectedPOIs.length === 0) {
      setError('Please select at least one point of interest.');
      return;
    }
    
    // Log location data for selected POIs
    console.log("📍 DEBUG LOCATION - POIs before tour route generation:", 
      selectedPOIs.map(poi => {
        const location = poi.geometry?.location;
        const latValue = location?.lat;
        const lngValue = location?.lng;
        
        return {
          name: poi.name,
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
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const { route, stats } = await generateTourRoute(selectedPOIs, tourPreferences);
      
      // Log location data for generated route
      console.log("📍 DEBUG LOCATION - Generated route with location data:", 
        route.map(poi => {
          const location = poi.geometry?.location;
          const latValue = location?.lat;
          const lngValue = location?.lng;
          
          return {
            name: poi.name,
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
      
      onGenerateTour(route, stats);
    } catch (err) {
      console.error('Error generating tour:', err);
      setError('Failed to generate tour. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Get default image for POI or placeholder
  const getPoiImage = (poi: POI) => {
    const photos = poi.photos || (poi.details?.photos);
    
    if (!photos || photos.length === 0) {
      return '/placeholder-poi.jpg'; // Add a placeholder image to your public folder
    }
    
    // Use the getUrl function provided by Google Places API instead of building URL manually
    try {
      if (photos[0].getUrl) {
        return photos[0].getUrl({ maxWidth: 400 });
      } else if (photos[0].photo_reference) {
        // Fallback to manual URL using photo_reference
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photos[0].photo_reference}&key=${apiKey}`;
      } else {
        return '/placeholder-poi.jpg';
      }
    } catch (error) {
      console.error('Error getting photo URL:', error);
      return '/placeholder-poi.jpg';
    }
  };
  
  const handleSelectPOI = (poi: POI) => {
    console.log(`📸 DEBUG: POI selected with photo data:`, 
      poi.photos ? poi.photos.map(photo => ({
        photo_reference: photo.photo_reference,
        hasGetUrl: !!(photo.getUrl),
        width: photo.width,
        height: photo.height,
        attributions: photo.html_attributions
      })) : 'No photos'
    );
    
    if (selectedPOIs.some(p => p.place_id === poi.place_id)) {
      setSelectedPOIs(selectedPOIs.filter(p => p.place_id !== poi.place_id));
    } else {
      setSelectedPOIs([...selectedPOIs, poi]);
    }
  };
  
  return (
    <div className="bg-slate-900 rounded-lg shadow-md p-6 mx-auto max-w-6xl border border-purple-900/30">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Select Points of Interest</h2>
        <div className="text-sm text-gray-300">
          Selected: <span className="font-medium text-purple-200">{selectedPOIs.length}</span>
          {recommendedCount > 0 && (
            <span> (Recommended: {recommendedCount})</span>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 rounded-md border border-red-800/50">
          {error}
        </div>
      )}
      
      {pois.length === 0 ? (
        <div className="text-gray-300 text-center py-8">
          No points of interest found for your preferences. Try adjusting your search parameters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {pois.map(poi => (
            <div 
              key={poi.place_id}
              className={`border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                selectedPOIs.some(p => p.place_id === poi.place_id)
                  ? 'border-pink-600 ring-2 ring-pink-600/20' 
                  : 'border-purple-900/30 hover:border-purple-700'
              } bg-slate-800`}
              onClick={() => togglePOISelection(poi)}
            >
              <div className="h-32 relative overflow-hidden rounded-t-md bg-slate-700">
                {poi.photos && poi.photos[0] ? (
                  <Image 
                    src={getPoiImage(poi)}
                    alt={poi.name}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                
                {/* Selection indicator */}
                {selectedPOIs.some(p => p.place_id === poi.place_id) && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-white mb-1">{poi.name}</h3>
                <p className="text-gray-300 text-sm mb-2">{poi.vicinity}</p>
                <div className="flex items-center">
                  <div className="flex items-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-200">
                      {poi.rating ? poi.rating.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                  {poi.user_ratings_total && (
                    <div className="text-sm text-gray-400">
                      ({poi.user_ratings_total} reviews)
                    </div>
                  )}
                </div>
                
                {/* Display website link if available */}
                {poi.details?.website && (
                  <div className="mt-2">
                    <a 
                      href={poi.details.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-pink-400 hover:text-pink-300 text-sm"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-purple-900/30 rounded-md text-gray-300 hover:bg-slate-800 focus:outline-none"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleGenerateTour}
          disabled={selectedPOIs.length === 0 || isGenerating}
          className={`px-4 py-2 rounded-md text-white focus:outline-none ${
            selectedPOIs.length === 0 || isGenerating
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 hover:opacity-90 shadow-md'
          }`}
        >
          {isGenerating ? 'Generating...' : 'Generate Tour'}
        </button>
      </div>
    </div>
  );
} 