/**
 * Places API Service
 * Handles interactions with Google Places API for POI discovery and route planning
 */

// Type definitions
export interface Location {
  lat: number;
  lng: number;
}

export interface LocationWithAddress {
  position: Location;
  address: string;
  useCurrentLocation?: boolean;
}

export interface POI {
  place_id: string;
  name: string;
  types: string[];
  vicinity: string;
  geometry: {
    location: Location;
  };
  photos?: {
    photo_reference?: string;
    width: number;
    height: number;
    html_attributions?: string[];
    getUrl?: (options?: { maxWidth?: number; maxHeight?: number }) => string;
  }[];
  rating?: number;
  user_ratings_total?: number;
  details?: POIDetails;
  selected?: boolean;
}

export interface POIDetails {
  formatted_address: string;
  formatted_phone_number?: string;
  opening_hours?: {
    weekday_text: string[];
    open_now?: boolean;
    periods?: any[];
    isOpen?: () => boolean;
  };
  website?: string;
  url?: string;
  price_level?: number;
  photos?: {
    photo_reference?: string;
    width: number;
    height: number;
    html_attributions?: string[];
    getUrl?: (options?: { maxWidth?: number; maxHeight?: number }) => string;
  }[];
  reviews?: {
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }[];
}

export interface TourPreferences {
  interests: string[];
  duration: number; // in minutes
  distance: number; // in kilometers
  startLocation: LocationWithAddress;
  endLocation: LocationWithAddress;
  returnToStart: boolean;
  transportationMode: 'walking' | 'transit';
}

// Function to map our interest categories to Google Places API types
function mapInterestToGoogleType(interest: string): string[] {
  const mapping: Record<string, string[]> = {
    'History': ['museum', 'historic', 'landmark', 'tourist_attraction'],
    'Architecture': ['landmark', 'church', 'place_of_worship', 'tourist_attraction'],
    'Art': ['art_gallery', 'museum'],
    'Nature': ['park', 'natural_feature']
  };
  
  return mapping[interest] || [];
}

/**
 * Discover POIs based on user preferences
 */
export async function discoverPOIs(
  preferences: TourPreferences, 
  options: { maxResults?: number } = {}
): Promise<POI[]> {
  const { interests, distance, startLocation } = preferences;
  const { maxResults } = options;
  
  // Calculate search radius in meters
  const searchRadius = distance * 1000; // Convert km to meters
  const effectiveRadius = preferences.returnToStart ? searchRadius / 2 : searchRadius;
  
  // Estimate how many POIs to return
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

  // Calculate recommended count using the new function
  const recommendedPOICount = calculateRecommendedCount(preferences.duration);
  
  // If maxResults is provided, use it to limit the presentation count
  const presentationPOICount = maxResults || Math.min(30, recommendedPOICount * 4);
  
  // POIs will be collected here
  let allPOIs: POI[] = [];
  
  try {
    // Use window.google.maps.places.PlacesService if available (client-side)
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      // Create a dummy map element for the PlacesService
      const mapElement = document.createElement('div');
      const placesService = new window.google.maps.places.PlacesService(mapElement);
      
      // Make requests for each interest
      for (const interest of interests) {
        const types = mapInterestToGoogleType(interest);
        
        // For each type in the interest category
        for (const type of types) {
          // Create the request
          const request = {
            location: startLocation.position,
            radius: effectiveRadius,
            type: type,
            keyword: interest
          };
          
          // Make the request
          const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
            placesService.nearbySearch(request, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
              } else {
                resolve([]);
              }
            });
          });
          
          // Add results to allPOIs
          allPOIs = [...allPOIs, ...results as unknown as POI[]];
        }
      }
      
      // Filter and remove duplicates
      const uniquePOIs = removeDuplicates(allPOIs);
      
      // Filter by rating - lower the threshold from 4.0 to 3.5 to get more results
      const qualityPOIs = uniquePOIs.filter(poi => poi.rating && poi.rating >= 3.5);
      
      // Sort by number of reviews
      const rankedPOIs = qualityPOIs.sort((a, b) => 
        (b.user_ratings_total || 0) - (a.user_ratings_total || 0)
      );
      
      // Use the full recommended count - no longer limiting to just 3 POIs
      let presentationPOIs = rankedPOIs.slice(0, Math.min(rankedPOIs.length, presentationPOICount));
      
      // If we still don't have enough POIs, include some regardless of rating
      if (presentationPOIs.length < presentationPOICount && uniquePOIs.length > presentationPOIs.length) {
        const additionalPOIs = uniquePOIs
          .filter(poi => !presentationPOIs.some(p => p.place_id === poi.place_id))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, presentationPOICount - presentationPOIs.length);
        
        presentationPOIs = [...presentationPOIs, ...additionalPOIs];
      }
      
      // Fetch additional details for these POIs
      const enhancedPOIs = await Promise.all(
        presentationPOIs.map(poi => fetchPOIDetails(poi, placesService))
      );
      
      // Log the POIs with their location data before returning
      console.log("📍 DEBUG LOCATION - Discovered POIs with location data:", 
        enhancedPOIs.map(poi => {
          const location = poi.geometry?.location;
          const latValue = location?.lat;
          const lngValue = location?.lng;
          
          return {
            name: poi.name,
            location: location,
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
      
      return enhancedPOIs;
    } else {
      // Server-side or no Google Maps available
      console.error('Google Maps not available');
      return [];
    }
  } catch (error) {
    console.error('Error discovering POIs:', error);
    return [];
  }
}

/**
 * Fetch additional details for a POI
 */
async function fetchPOIDetails(poi: POI, placesService: google.maps.places.PlacesService): Promise<POI> {
  try {
    // Create the request
    const request = {
      placeId: poi.place_id,
      fields: ['formatted_address', 'formatted_phone_number', 'opening_hours', 'website', 'url', 'price_level', 'review', 'photo']
    };
    
    // Make the request
    const placeDetails = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
      placesService.getDetails(request, (result: google.maps.places.PlaceResult | null, status: google.maps.places.PlacesServiceStatus) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && result) {
          resolve(result);
        } else {
          reject(new Error(`Failed to fetch place details: ${status}`));
        }
      });
    });
    
    // Merge the original POI with the details
    return {
      ...poi,
      details: placeDetails as unknown as POIDetails
    };
  } catch (error) {
    console.error(`Error fetching details for POI ${poi.place_id}:`, error);
    return poi;
  }
}

/**
 * Remove duplicate POIs by place_id
 */
function removeDuplicates(pois: POI[]): POI[] {
  const uniquePOIs: POI[] = [];
  const placeIds = new Set<string>();
  
  for (const poi of pois) {
    if (poi.place_id && !placeIds.has(poi.place_id)) {
      placeIds.add(poi.place_id);
      uniquePOIs.push(poi);
    }
  }
  
  return uniquePOIs;
}

/**
 * Generate optimized route from selected POIs
 */
export async function generateTourRoute(
  selectedPOIs: POI[], 
  preferences: TourPreferences
): Promise<{ route: POI[], stats: any }> {
  const { startLocation, endLocation, returnToStart } = preferences;
  
  try {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      // Create a Distance Matrix Service
      const distanceMatrixService = new window.google.maps.DistanceMatrixService();
      
      // Prepare origins and destinations for the distance matrix
      const origins = [
        startLocation.position,
        ...selectedPOIs.map(poi => poi.geometry.location)
      ];
      
      const destinations = [
        ...selectedPOIs.map(poi => poi.geometry.location),
        returnToStart ? startLocation.position : (endLocation.position || startLocation.position)
      ];
      
      // Get distance matrix
      const distanceMatrix = await new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
        // Ensure we're using the correct transportation mode
        const travelMode = preferences.transportationMode === 'transit' 
          ? window.google.maps.TravelMode.TRANSIT 
          : window.google.maps.TravelMode.WALKING;
          
        console.log(`Using transportation mode: ${preferences.transportationMode} (${travelMode})`);
        
        distanceMatrixService.getDistanceMatrix(
          {
            origins,
            destinations,
            travelMode: travelMode,
            unitSystem: window.google.maps.UnitSystem.METRIC
          },
          (response: google.maps.DistanceMatrixResponse | null, status: string) => {
            if (status === 'OK' && response) {
              resolve(response);
            } else {
              reject(new Error(`Distance Matrix request failed: ${status}`));
            }
          }
        );
      });
      
      // Build route with greedy algorithm
      const tourRoute: POI[] = [];
      const startPOI = { 
        place_id: 'start', 
        name: 'Starting Point', 
        vicinity: startLocation.address,
        geometry: { 
          location: startLocation.position 
        },
        types: ['starting_point']
      };
      
      // Add starting point
      tourRoute.push(startPOI);
      
      let currentLocation = startPOI;
      let remainingPOIs = [...selectedPOIs];
      
      // Find optimal next POI at each step
      while (remainingPOIs.length > 0) {
        // Find nearest POI to current location
        const nextPOI = findNearestPOI(
          currentLocation, 
          remainingPOIs, 
          distanceMatrix, 
          tourRoute.length - 1 // Current index in the origins array
        );
        
        tourRoute.push(nextPOI);
        
        // Remove this POI from remaining list
        remainingPOIs = remainingPOIs.filter(poi => poi.place_id !== nextPOI.place_id);
        
        // Update current location
        currentLocation = nextPOI;
      }
      
      // Add end location
      if (returnToStart) {
        tourRoute.push({
          ...startPOI,
          name: 'Return to Start',
          types: ['end_point', 'return_to_start']
        });
      } else if (endLocation && endLocation.position) {
        tourRoute.push({
          place_id: 'end',
          name: 'End Point',
          vicinity: endLocation.address,
          geometry: { 
            location: endLocation.position 
          },
          types: ['end_point']
        });
      }
      
      // Calculate stats
      // POI visit duration should be adaptive based on tour preferences
      let POI_VISIT_DURATION = 15; // default 15 minutes per POI
      
      // Adjust POI duration based on total tour preferences
      if (preferences.duration <= 60) {
        // For shorter tours, still give reasonable time at each POI
        POI_VISIT_DURATION = 15; 
      } else if (preferences.duration >= 120) {
        // For longer tours, more time at each POI
        POI_VISIT_DURATION = 25;
      }
      
      const stats = calculateTourStats(tourRoute, distanceMatrix, POI_VISIT_DURATION);
      
      // Apply a realistic minimum tour duration (15 minutes) if the calculated one is too short
      if (stats.totalTourDuration < 15 && stats.totalPOIs > 0) {
        console.log(`🕒 DEBUG ETA: Calculated duration (${stats.totalTourDuration.toFixed(1)} min) is unrealistically short. Applying minimum of 15 minutes.`);
        stats.totalTourDuration = 15;
      }
      
      return { route: tourRoute, stats };
    } else {
      console.error('Google Maps not available');
      return { route: [], stats: {} };
    }
  } catch (error) {
    console.error('Error generating tour route:', error);
    return { route: [], stats: {} };
  }
}

/**
 * Find the nearest POI to the current location
 */
function findNearestPOI(
  currentPOI: POI, 
  remainingPOIs: POI[], 
  distanceMatrix: google.maps.DistanceMatrixResponse,
  currentIndex: number
): POI {
  let nearestPOI = remainingPOIs[0];
  let shortestTime = Infinity;
  
  for (let i = 0; i < remainingPOIs.length; i++) {
    const poi = remainingPOIs[i];
    const row = distanceMatrix.rows[currentIndex];
    if (row && row.elements) {
      const element = row.elements[remainingPOIs.indexOf(poi)];
      if (element && element.duration && element.duration.value) {
        const travelTime = element.duration.value; // in seconds
        if (travelTime < shortestTime) {
          shortestTime = travelTime;
          nearestPOI = poi;
        }
      }
    }
  }
  
  return nearestPOI;
}

/**
 * Calculate tour statistics
 */
function calculateTourStats(
  tourRoute: POI[], 
  distanceMatrix: google.maps.DistanceMatrixResponse,
  poiVisitDuration: number
): any {
  let totalWalkingDistance = 0;
  let totalWalkingTime = 0;
  const distances: number[] = [];
  const times: number[] = [];
  
  console.log(`🕒 DEBUG ETA: Calculating stats for ${tourRoute.length} points with ${poiVisitDuration} min per POI`);
  
  // Calculate walking distance and time
  for (let i = 0; i < tourRoute.length - 1; i++) {
    const row = distanceMatrix.rows[i];
    if (row && row.elements) {
      // Fix: For each point in the route, we want the travel time to the next point
      // The distance matrix is structured such that rows[i].elements[j] gives the travel
      // from origins[i] to destinations[j]
      // Since destinations are offset by 1 (they don't include start point but include end point),
      // we need to look at element[i]
      const element = row.elements[i];
      
      if (element && element.distance && element.duration) {
        const distanceKm = element.distance.value / 1000; // in km
        const durationMin = element.duration.value / 60; // in minutes
        
        // Add a 20% buffer to travel times to account for real-world delays
        const bufferedDuration = durationMin * 1.2;
        
        console.log(`🕒 DEBUG ETA: Segment ${i}: ${tourRoute[i].name} -> ${tourRoute[i+1].name}: ${durationMin.toFixed(1)} min (buffered: ${bufferedDuration.toFixed(1)} min), ${distanceKm.toFixed(2)} km`);
        
        totalWalkingDistance += element.distance.value; // in meters
        totalWalkingTime += element.duration.value * 1.2; // in seconds, with 20% buffer
        
        distances.push(distanceKm);
        times.push(bufferedDuration);
      } else {
        console.log(`🕒 DEBUG ETA: Segment ${i}: No valid distance/duration data found`);
        distances.push(0);
        times.push(0);
      }
    }
  }
  
  const totalPOIs = tourRoute.length - 2; // Excluding start and end
  const totalVisitTime = totalPOIs * poiVisitDuration * 60; // in seconds
  const totalTourDuration = totalWalkingTime + totalVisitTime; // in seconds
  
  const result = {
    totalPOIs,
    totalWalkingDistance: totalWalkingDistance / 1000, // in km
    totalWalkingTime: totalWalkingTime / 60, // in minutes
    totalVisitTime: totalVisitTime / 60, // in minutes
    totalTourDuration: totalTourDuration / 60, // in minutes
    distances,
    times
  };
  
  console.log(`🕒 DEBUG ETA: Final stats:`, {
    totalPOIs,
    totalWalkingDistance: (totalWalkingDistance / 1000).toFixed(2) + ' km',
    totalWalkingTime: (totalWalkingTime / 60).toFixed(1) + ' min',
    totalVisitTime: (totalVisitTime / 60).toFixed(1) + ' min',
    totalTourDuration: (totalTourDuration / 60).toFixed(1) + ' min',
  });
  
  return result;
}

// Declare types for the Google Maps API
declare global {
  interface Window {
    google: {
      maps: {
        places: {
          PlacesService: any;
          PlacesServiceStatus: any;
        };
        DistanceMatrixService: any;
        TravelMode: {
          WALKING: string;
          TRANSIT: string;
        };
        UnitSystem: {
          METRIC: number;
        };
      };
    };
  }
} 