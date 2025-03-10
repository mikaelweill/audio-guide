import prisma from '@/lib/prisma';
import { POI, TourPreferences } from '@/lib/places-api';
import axios from 'axios';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { createServerSupabaseClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Use only the server-side client for admin operations
async function getSupabaseClient() {
  try {
    // Get server client which has service role for admin operations
    const serverClient = await createServerSupabaseClient();
    return serverClient;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    throw new Error('Failed to initialize Supabase client');
  }
}

// Simple function to ensure the bucket exists
async function ensurePoiImagesBucket() {
  // Do nothing - bucket already exists
  return;
}

// No need to run the check since it does nothing
// ensurePoiImagesBucket();

// Type for tour creation
interface CreateTourInput {
  userId: string;
  name: string;
  description?: string;
  route: POI[];
  preferences: TourPreferences;
  stats: any;
}

/**
 * Generate a Google Maps deep link for a route
 */
export function generateGoogleMapsLink(
  route: POI[],
  transportationMode: string
): string {
  if (route.length < 2) return '';

  const start = route[0];
  const end = route[route.length - 1];
  const waypoints = route.slice(1, -1);

  // Extract coordinates safely, handling different location formats
  const getLocationCoords = (poi: POI) => {
    if (!poi.geometry || !poi.geometry.location) {
      console.error('Missing location data for POI:', poi.name);
      return { lat: 0, lng: 0 }; // Default fallback
    }
    
    const location = poi.geometry.location;
    
    // Safe extraction regardless of type
    let lat = 0;
    let lng = 0;
    
    if (location) {
      // Handle Google Maps LatLng objects which may have function-based lat/lng
      if (typeof location.lat === 'function' && typeof location.lng === 'function') {
        try {
          lat = (location.lat as Function)();
          lng = (location.lng as Function)();
          console.log(`   Successfully extracted function-based coordinates for ${poi.name}:`, { lat, lng });
        } catch (error) {
          console.error(`   Error extracting function-based coordinates for ${poi.name}:`, error);
        }
      }
      // Handle regular object with properties
      else if (typeof location === 'object') {
        lat = typeof location.lat === 'number' ? location.lat : 
             (typeof location.lat === 'string' ? parseFloat(location.lat) : 0);
        
        lng = typeof location.lng === 'number' ? location.lng : 
             (typeof location.lng === 'string' ? parseFloat(location.lng) : 0);
      }
    }
    
    // Add debug logging
    console.log(`   Extracted coordinates for ${poi.name}: ${lat},${lng}`);
    
    return { lat, lng };
  };

  // Get coordinates safely
  const startCoords = getLocationCoords(start);
  const endCoords = getLocationCoords(end);

  console.log(`🗺️ Creating Google Maps link with:
    - Start: ${start.name} at ${startCoords.lat},${startCoords.lng}
    - End: ${end.name} at ${endCoords.lat},${endCoords.lng}
    - Waypoints: ${waypoints.length}`);

  let url = 'https://www.google.com/maps/dir/?api=1';

  // Add origin
  url += `&origin=${startCoords.lat},${startCoords.lng}`;

  // Add destination
  url += `&destination=${endCoords.lat},${endCoords.lng}`;

  // Add waypoints if any
  if (waypoints.length > 0) {
    const waypointsString = waypoints
      .map(poi => {
        const coords = getLocationCoords(poi);
        return `${coords.lat},${coords.lng}`;
      })
      .join('|');
    url += `&waypoints=${waypointsString}`;
  }

  // Add travel mode
  url += `&travelmode=${transportationMode === 'transit' ? 'transit' : 'walking'}`;

  return url;
}

/**
 * Generate a Google Maps deep link for a single POI
 */
export function generatePOILink(poi: POI): string {
  return `https://www.google.com/maps/search/?api=1&query=${poi.geometry.location.lat},${poi.geometry.location.lng}&query_place_id=${poi.place_id}`;
}

/**
 * Download and store a POI thumbnail image in Supabase Storage
 * @returns Object containing the bucket path and attribution
 */
export async function downloadAndStorePOIImage(
  poi: POI,
  poiId: string
): Promise<{ path: string | null; attribution: string | null }> {
  // Don't skip on server, but log environment for debugging
  if (!isBrowser) {
    console.log('📸 Running image download in server environment');
  } else {
    console.log('📸 Running image download in browser environment');
  }
  
  // No need to check bucket - we know it already exists
  // No need for this: await ensurePoiImagesBucket();
  
  const MAX_RETRIES = 2;
  let retryCount = 0;
  
  try {
    console.log(`🖼️ Starting image download for POI: ${poi.name} (ID: ${poiId})`);
    
    // Skip if no photos available
    if (!poi.photos || poi.photos.length === 0) {
      console.log(`📸 No photos available for POI: ${poi.name}`);
      return { path: null, attribution: null };
    }

    // Get first photo and its attribution
    const photo = poi.photos[0];
    const attribution = photo.html_attributions && photo.html_attributions.length > 0 
      ? photo.html_attributions[0]
      : null;
    
    // Get API key for Google Places
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('❌ No Google Maps API key available');
      return { path: null, attribution };
    }
    
    // Determine photo URL - check all possible sources
    let photoUrl;
    
    // Use type assertion to handle potential custom fields from client
    const photoAny = photo as any;
    
    // 1. Check for pre-calculated URL (from client preparation)
    if (photoAny.url) {
      photoUrl = photoAny.url;
      console.log('📸 Using pre-calculated URL from client');
    }
    // 2. Check for getUrl method
    else if (typeof photo.getUrl === 'function') {
      photoUrl = photo.getUrl({ maxWidth: 800 });
      console.log('📸 Using getUrl method');
    } 
    // 3. Fall back to photo_reference
    else if (photo.photo_reference) {
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${apiKey}`;
      console.log('📸 Using photo_reference to construct URL');
    } else {
      console.error('❌ No method available to get photo URL');
      return { path: null, attribution };
    }
    
    // Fetch the image
    console.log(`📥 Fetching image from: ${photoUrl.substring(0, 50)}...`);
    try {
      const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      
      // Create a unique file name
      const timestamp = new Date().getTime();
      const fileName = `${poiId}/${timestamp}.jpg`;
      const bucketName = 'poi-images';
      
      console.log(`💾 Uploading ${buffer.length} bytes to ${bucketName}/${fileName}`);
      
      // Get admin Supabase client for storage operations
      const supabaseClient = await getSupabaseClient();
      console.log('📊 Using Supabase server client for upload');
      
      // Upload to Supabase storage using admin client
      const { data, error } = await supabaseClient.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
      
      if (error) {
        console.error('❌ Error uploading image:', error);
        return { path: null, attribution };
      }
      
      console.log(`✅ Image uploaded successfully: ${fileName}`);
      return { path: fileName, attribution };
    } catch (fetchError) {
      console.error('❌ Error fetching or uploading image:', fetchError);
      return { path: null, attribution };
    }
  } catch (error) {
    console.error('❌ Error downloading/storing POI image:', error);
    return { path: null, attribution: null };
  }
}

/**
 * Save a POI to the database
 */
export async function savePOI(poi: POI): Promise<string> {
  try {
    // Check if POI already exists by place_id
    const existingPOI = await prisma.poi.findUnique({
      where: { place_id: poi.place_id }
    });
    
    // Prepare location data safely for Prisma
    const location = poi.geometry.location;
    
    // Log location object details
    console.log(`📍 DEBUG LOCATION - Saving POI "${poi.name}" location:`, {
      locationType: typeof location,
      hasLatProperty: 'lat' in location,
      hasLngProperty: 'lng' in location,
      latType: typeof location.lat,
      lngType: typeof location.lng,
      isLatFunction: typeof location.lat === 'function',
      isLngFunction: typeof location.lng === 'function'
    });
    
    // Get actual lat/lng values
    let lat, lng;
    
    if (typeof location.lat === 'function' && typeof location.lng === 'function') {
      try {
        lat = (location.lat as Function)();
        lng = (location.lng as Function)();
      } catch (error) {
        console.error('Error calling lat/lng functions:', error);
        lat = 0;
        lng = 0;
      }
    } else {
      lat = location.lat;
      lng = location.lng;
    }
    
    const locationData = {
      lat: lat,
      lng: lng
    };
    
    console.log(`   Final location data being saved: ${JSON.stringify(locationData)}`);
    
    // Prepare common data values safely for Prisma
    let openingHoursValue;
    if (poi.details?.opening_hours) {
      // If opening_hours exists, convert to JSON string
      openingHoursValue = JSON.stringify(poi.details.opening_hours);
    } else {
      // If opening_hours is null, use Prisma's DbNull
      openingHoursValue = Prisma.DbNull;
    }
    
    const commonData = {
      name: poi.name,
      vicinity: poi.vicinity || null,
      formatted_address: poi.details?.formatted_address || poi.vicinity || '',
      location: locationData,
      types: Array.isArray(poi.types) ? poi.types : [],
      rating: poi.rating || null,
      user_ratings_total: poi.user_ratings_total || null,
      website: poi.details?.website || null,
      phone_number: poi.details?.formatted_phone_number || null,
      price_level: poi.details?.price_level || null,
      opening_hours: openingHoursValue,
      google_maps_url: generatePOILink(poi),
      // Filter out undefined values from photo references array
      photo_references: poi.photos 
        ? poi.photos
            .map(p => p.photo_reference)
            .filter(ref => ref !== undefined)
        : []
    };
    
    if (existingPOI) {
      // Update the existing POI with new data
      const updatedPOI = await prisma.poi.update({
        where: { id: existingPOI.id },
        data: {
          ...commonData,
          last_updated_at: new Date()
        }
      });
      
      return updatedPOI.id;
    } else {
      // Create a new POI
      const newPOI = await prisma.poi.create({
        data: {
          id: uuidv4(),
          place_id: poi.place_id,
          ...commonData,
          last_updated_at: new Date()
        }
      });
      
      return newPOI.id;
    }
  } catch (error) {
    console.error('Error saving POI:', error);
    throw new Error(`Failed to save POI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a new tour with its POIs
 */
export async function createTour({
  userId,
  name,
  description,
  route,
  preferences,
  stats
}: CreateTourInput): Promise<string> {
  try {
    // Validate that we have POIs in the route
    if (!route || route.length === 0) {
      throw new Error('Cannot create tour with empty route');
    }
    
    // Confirm we have valid start and end locations
    const startLocation = route[0].geometry.location;
    const endLocation = route[route.length - 1].geometry.location;
    
    if (!startLocation || !endLocation) {
      throw new Error('Missing start or end location in route');
    }
    
    // Prepare location data as simple objects for Prisma
    const extractAndNormalizeLocation = (poi: POI) => {
      // Get location data
      let location = { 
        lat: 0, 
        lng: 0,
        address: poi.vicinity || poi.details?.formatted_address || ''
      };
      
      console.log(`📍 DEBUG LOCATION - Extracting location for "${poi.name || 'unknown POI'}":`);
      
      if (poi.geometry?.location) {
        const locObj = poi.geometry.location;
        
        // Log detailed information about the location object
        console.log(`   Location object details:`, {
          type: typeof locObj,
          keys: Object.keys(locObj),
          hasLatProperty: 'lat' in locObj,
          hasLngProperty: 'lng' in locObj,
          latType: typeof locObj.lat,
          lngType: typeof locObj.lng,
          latValue: locObj.lat,
          lngValue: locObj.lng,
          isLatFunction: typeof locObj.lat === 'function',
          isLngFunction: typeof locObj.lng === 'function',
          toString: locObj.toString ? locObj.toString() : 'No toString method'
        });
        
        // Handle different types of location objects
        if (typeof locObj === 'object') {
          // Extract just lat and lng as numbers, nothing else
          let lat: number;
          let lng: number;
          
          // Handle function-based lat/lng (Google Maps LatLng objects)
          if (typeof locObj.lat === 'function' && typeof locObj.lng === 'function') {
            try {
              lat = (locObj.lat as Function)();
              lng = (locObj.lng as Function)();
              console.log(`   Successfully called lat/lng functions:`, { lat, lng });
            } catch (error) {
              console.error(`   Error calling lat/lng functions:`, error);
              lat = 0;
              lng = 0;
            }
          } else {
            // Handle property-based lat/lng
            lat = typeof locObj.lat === 'number' ? locObj.lat : 
                 (typeof locObj.lat === 'string' ? parseFloat(locObj.lat) : 0);
            
            lng = typeof locObj.lng === 'number' ? locObj.lng : 
                 (typeof locObj.lng === 'string' ? parseFloat(locObj.lng) : 0);
          }
          
          // Format to 7 decimal places and convert to number
          location = { 
            lat: Number(parseFloat(lat.toString()).toFixed(7)), 
            lng: Number(parseFloat(lng.toString()).toFixed(7)),
            address: poi.vicinity || poi.details?.formatted_address || ''
          };
        }
      } else {
        console.log(`   No location data found for this POI`);
      }
      
      console.log(`   Normalized location result: ${JSON.stringify(location)}`);
      return location;
    };

    // Now use this to prepare location data
    const startLocationData = extractAndNormalizeLocation(route[0]);
    const endLocationData = extractAndNormalizeLocation(route[route.length - 1]);

    // Log the exact data being saved to database
    console.log('📌 SAVING TO DATABASE - Start location:', JSON.stringify(startLocationData));
    console.log('📌 SAVING TO DATABASE - End location:', JSON.stringify(endLocationData));

    // Generate Google Maps deep link for the full route
    const googleMapsUrl = generateGoogleMapsLink(route, preferences.transportationMode);
    
    // Store POI IDs to process images AFTER transaction completes
    const pois_to_update_with_images: {poi: POI, poiId: string}[] = [];
    
    // Start transaction to ensure all data is saved together
    const tourId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Generate a UUID for the tour
      const tourId = uuidv4();
      
      // 1. Create the tour first
      const tour = await tx.tour.create({
        data: {
          id: tourId,
          user_id: userId,
          name,
          description,
          start_location: startLocationData,
          end_location: endLocationData,
          return_to_start: preferences.returnToStart,
          transportation_mode: preferences.transportationMode,
          total_distance: stats.totalWalkingDistance || 0,
          total_duration: stats.totalTourDuration || 0,
          google_maps_url: googleMapsUrl,
          preferences: JSON.parse(JSON.stringify(preferences)), // Ensure serializable
          last_updated_at: new Date(),
          created_at: new Date()
        }
      });
      
      console.log(`🕒 DEBUG ETA: Saving tour with duration: ${stats.totalTourDuration} minutes`);
      console.log(`🕒 DEBUG ETA: Complete stats being saved:`, {
        walkingDistance: stats.totalWalkingDistance,
        walkingTime: stats.totalWalkingTime,
        visitTime: stats.totalVisitTime,
        totalTime: stats.totalTourDuration,
        poiCount: stats.totalPOIs,
        transportMode: preferences.transportationMode
      });
      
      // 2. Save all POIs
      for (let i = 0; i < route.length; i++) {
        const poi = route[i];
        
        console.log(`Processing POI #${i}: ${poi.name} (place_id: ${poi.place_id})`);
        console.log(`POI has photos: ${!!(poi.photos && poi.photos.length > 0)}`);
        if (poi.photos && poi.photos.length > 0) {
          console.log(`Photo details: ${JSON.stringify({
            hasPhotoRef: !!poi.photos[0].photo_reference,
            hasGetUrl: !!poi.photos[0].getUrl,
            attributions: poi.photos[0].html_attributions?.length || 0
          })}`);
        }
        
        // Skip if this is just a start/end marker without place data
        if (poi.types.includes('starting_point') || poi.types.includes('end_point')) {
          console.log(`Processing special point: ${poi.name} (${poi.types.join(', ')})`);
          
          // We now want to include these points, just not as POIs
          // Instead of skipping them, we'll use them for other purposes
          if (poi.types.includes('starting_point')) {
            console.log(`Using ${poi.name} as starting point with address: ${poi.vicinity || 'Unknown'}`);
          } else if (poi.types.includes('end_point')) {
            console.log(`Using ${poi.name} as ending point with address: ${poi.vicinity || 'Unknown'}`);
          }
          
          // Skip saving as POI but keep in the tour
          continue;
        }
        
        // Save the POI
        const poiId = await savePOI(poi);
        console.log(`POI saved with ID: ${poiId}`);
        
        // Instead of downloading images now, store the POI for later processing
        if (poiId && poi.photos && poi.photos.length > 0) {
          pois_to_update_with_images.push({ poi, poiId });
        }
        
        // Create TourPoi relationship with sequence number
        await tx.tourPoi.create({
          data: {
            id: uuidv4(),
            tour_id: tour.id,
            poi_id: poiId,
            sequence_number: i,
            // Calculate distance and time to next POI (if not the last one)
            distance_to_next: i < route.length - 1 ? stats.distances?.[i] || null : null,
            time_to_next: i < route.length - 1 ? stats.times?.[i] || null : null
          }
        });
      }
      
      return tourId;
    }, { timeout: 10000 }); // Increase timeout slightly to be safe

    // AFTER transaction completes, process images in parallel
    console.log(`📸 Transaction completed. Now processing ${pois_to_update_with_images.length} images outside transaction`);
    
    // Process images in parallel to save time
    await Promise.all(pois_to_update_with_images.map(async ({ poi, poiId }) => {
      try {
        console.log(`🔍 Attempting to download and store image for POI: ${poi.name} (${poiId})`);
        
        // First, check if the POI already has an image in the database
        const existingPoi = await prisma.poi.findUnique({
          where: { id: poiId },
          select: { thumbnail_url: true }
        });
        
        // If POI already has an image, skip downloading
        if (existingPoi?.thumbnail_url) {
          console.log(`🖼️ POI ${poi.name} already has an image: ${existingPoi.thumbnail_url}`);
          console.log(`⏭️ Skipping image download for POI: ${poi.name}`);
          return; // Skip to the next POI
        }
        
        const imageResult = await downloadAndStorePOIImage(poi, poiId);
        const thumbnailPath = imageResult.path;
        const imageAttribution = imageResult.attribution;
        console.log(`🖼️ Image download result:`, { thumbnailPath, imageAttribution });
        
        // If we have image data, update the POI
        if (thumbnailPath || imageAttribution) {
          console.log(`📝 Updating POI with image data`);
          const updateData: any = {};
          
          if (thumbnailPath !== null) {
            updateData.thumbnail_url = thumbnailPath;
          }
          
          if (imageAttribution !== null) {
            updateData.image_attribution = imageAttribution;
          }
          
          if (Object.keys(updateData).length > 0) {
            console.log(`🔄 Updating POI ${poiId} with image data:`, updateData);
            await prisma.poi.update({
              where: { id: poiId },
              data: updateData
            });
            console.log(`✅ Successfully updated POI with image data`);
          }
        }
      } catch (imageError) {
        console.error(`❌ Error processing image for POI ${poiId}:`, imageError);
        // Continue with other images if one fails
      }
    }));
    
    return tourId;
  } catch (error) {
    console.error('Error creating tour:', error);
    
    // Provide more specific error messages
    if (error instanceof PrismaClientKnownRequestError) {
      // Handle known Prisma errors
      const errorMessage = `Database error (${error.code}): ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    } else if (error instanceof PrismaClientValidationError) {
      // Handle validation errors (often schema mismatches)
      console.error('Data validation error:', error.message);
      throw new Error(`Invalid data format: ${error.message}`);
    } else {
      // Handle other errors
      throw new Error(`Failed to create tour: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

