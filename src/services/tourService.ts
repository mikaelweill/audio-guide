import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/client';
import { POI, TourPreferences } from '@/lib/places-api';
import axios from 'axios';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

// Initialize the singleton Supabase client
const supabase = createClient();

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

  let url = 'https://www.google.com/maps/dir/?api=1';

  // Add origin
  url += `&origin=${start.geometry.location.lat},${start.geometry.location.lng}`;

  // Add destination
  url += `&destination=${end.geometry.location.lat},${end.geometry.location.lng}`;

  // Add waypoints if any
  if (waypoints.length > 0) {
    const waypointsString = waypoints
      .map(poi => `${poi.geometry.location.lat},${poi.geometry.location.lng}`)
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
 */
export async function downloadAndStorePOIImage(
  poi: POI,
  poiId: string
): Promise<string | null> {
  try {
    // Skip if no photos available
    if (!poi.photos || poi.photos.length === 0) {
      return null;
    }

    // Get first photo reference
    const photoRef = poi.photos[0].photo_reference;
    
    // Google Places Photo API URL
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`;
    
    // Fetch the image from Google
    const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    
    // Create a unique file name
    const timestamp = new Date().getTime();
    const fileName = `${poiId}/${timestamp}.jpg`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('poi-images')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('poi-images')
      .getPublicUrl(fileName);
      
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error downloading/storing POI image:', error);
    return null;
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
    
    if (existingPOI) {
      // Update the existing POI with new data
      const updatedPOI = await prisma.poi.update({
        where: { id: existingPOI.id },
        data: {
          name: poi.name,
          vicinity: poi.vicinity,
          formatted_address: poi.details?.formatted_address || poi.vicinity || '',
          location: poi.geometry.location,
          types: poi.types,
          rating: poi.rating,
          user_ratings_total: poi.user_ratings_total,
          website: poi.details?.website,
          phone_number: poi.details?.formatted_phone_number,
          price_level: poi.details?.price_level,
          opening_hours: poi.details?.opening_hours || null,
          google_maps_url: generatePOILink(poi),
          photo_references: poi.photos ? poi.photos.map(p => p.photo_reference) : [],
          last_updated_at: new Date()
        }
      });
      
      return updatedPOI.id;
    } else {
      // Create a new POI
      const newPOI = await prisma.poi.create({
        data: {
          place_id: poi.place_id,
          name: poi.name,
          vicinity: poi.vicinity,
          formatted_address: poi.details?.formatted_address || poi.vicinity || '',
          location: poi.geometry.location,
          types: poi.types,
          rating: poi.rating,
          user_ratings_total: poi.user_ratings_total,
          website: poi.details?.website,
          phone_number: poi.details?.formatted_phone_number,
          price_level: poi.details?.price_level,
          opening_hours: poi.details?.opening_hours || null,
          google_maps_url: generatePOILink(poi),
          photo_references: poi.photos ? poi.photos.map(p => p.photo_reference) : []
        }
      });
      
      return newPOI.id;
    }
  } catch (error) {
    console.error('Error saving POI:', error);
    throw error;
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
    
    // Generate Google Maps deep link for the full route
    const googleMapsUrl = generateGoogleMapsLink(route, preferences.transportationMode);
    
    // Start transaction to ensure all data is saved together
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create the tour first
      const tour = await tx.tour.create({
        data: {
          user_id: userId,
          name,
          description,
          start_location: startLocation,
          end_location: endLocation,
          return_to_start: preferences.returnToStart,
          transportation_mode: preferences.transportationMode,
          total_distance: stats.totalWalkingDistance || 0,
          total_duration: stats.totalTourDuration || 0,
          google_maps_url: googleMapsUrl,
          preferences: preferences
        }
      });
      
      // 2. Save all POIs
      for (let i = 0; i < route.length; i++) {
        const poi = route[i];
        
        // Skip if this is just a start/end marker without place data
        if (poi.types.includes('starting_point') || poi.types.includes('end_point')) {
          continue;
        }
        
        // Save the POI
        const poiId = await savePOI(poi);
        
        // Download and store thumbnail image
        let thumbnailUrl = null;
        if (poiId) {
          thumbnailUrl = await downloadAndStorePOIImage(poi, poiId);
          
          // Update the POI with the thumbnail URL if available
          if (thumbnailUrl) {
            await tx.poi.update({
              where: { id: poiId },
              data: { thumbnail_url: thumbnailUrl }
            });
          }
        }
        
        // Create TourPoi relationship with sequence number
        await tx.tourPoi.create({
          data: {
            tour_id: tour.id,
            poi_id: poiId,
            sequence_number: i,
            // Calculate distance and time to next POI (if not the last one)
            distance_to_next: i < route.length - 1 ? stats.distances?.[i] || null : null,
            time_to_next: i < route.length - 1 ? stats.times?.[i] || null : null
          }
        });
      }
      
      return tour.id;
    });
  } catch (error: unknown) {
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
      throw new Error(`Failed to save tour: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 