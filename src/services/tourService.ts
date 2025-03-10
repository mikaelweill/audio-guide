import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/client';
import { POI, TourPreferences } from '@/lib/places-api';
import axios from 'axios';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { createServerSupabaseClient } from '@/lib/supabase';

// Initialize Supabase clients - use both client and server versions
const supabaseClient = createClient(); // Regular client

// Use a function to get server client with admin privileges when needed
async function getAdminSupabaseClient() {
  try {
    // Get server client which can have service role
    const serverClient = await createServerSupabaseClient();
    return serverClient;
  } catch (error) {
    console.error('Error creating admin Supabase client:', error);
    // Fallback to regular client if server client fails
    return supabaseClient;
  }
}

// Simple function to ensure the bucket exists
async function ensurePoiImagesBucket() {
  console.log('🔄 Making sure poi-images bucket exists...');
  try {
    // Try to get admin client to bypass RLS
    const adminClient = await getAdminSupabaseClient();
    
    const { data: buckets, error } = await adminClient.storage.listBuckets();
    
    if (error) {
      console.error('⚠️ Error listing buckets:', error);
      return;
    }
    
    const bucketExists = buckets.some(b => b.name === 'poi-images');
    if (!bucketExists) {
      console.log('⚠️ poi-images bucket not found, creating it...');
      
      const { error: createError } = await adminClient.storage.createBucket('poi-images', {
        public: false, // Use private bucket for security
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        fileSizeLimit: 10 * 1024 * 1024 // 10MB
      });
      
      if (createError) {
        console.error('❌ Error creating bucket:', createError);
      } else {
        console.log('✅ poi-images bucket created successfully');
        
        // Note: We need to manually set RLS policies in the Supabase dashboard
        // The JavaScript client doesn't have a direct method to create RLS policies
        console.log('⚠️ Remember to set storage policies in Supabase dashboard to allow service role access');
      }
    } else {
      console.log('✅ poi-images bucket already exists');
    }
  } catch (error) {
    console.error('❌ Error checking/creating bucket:', error);
  }
}

// Run the check right away
ensurePoiImagesBucket();

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
  // Ensure we have a valid location
  const lat = poi.geometry.location.lat ?? 0;
  const lng = poi.geometry.location.lng ?? 0;
  
  // Build Google Maps URL with place_id (more reliable) and coordinates
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${poi.place_id}`;
}

/**
 * Download and store a POI thumbnail image in Supabase Storage
 * @returns Object containing the bucket path and attribution
 */
export async function downloadAndStorePOIImage(
  poi: POI,
  poiId: string
): Promise<{ path: string | null; attribution: string | null }> {
  const MAX_RETRIES = 2;
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      console.log(`🖼️ Downloading image for POI: ${poi.name} (ID: ${poiId}) - Attempt ${retryCount + 1}`);
      
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
      
      // Fetch the image with timeout and proper error handling
      console.log(`📥 Fetching image from URL: ${photoUrl.substring(0, 50)}...`);
      try {
        const response = await axios.get(photoUrl, { 
          responseType: 'arraybuffer',
          timeout: 5000, // 5 second timeout for fetching
          headers: {
            'User-Agent': 'AudioGuideApp/1.0'
          }
        });
        
        if (!response.data || response.data.length === 0) {
          throw new Error('Empty response data');
        }
        
        const buffer = Buffer.from(response.data, 'binary');
        
        if (buffer.length < 100) {
          throw new Error(`Suspiciously small image buffer (${buffer.length} bytes)`);
        }
        
        // Create a unique file name
        const timestamp = new Date().getTime();
        const fileName = `${poiId}/${timestamp}.jpg`;
        const bucketName = 'poi-images';
        
        console.log(`💾 Uploading ${buffer.length} bytes to ${bucketName}/${fileName}`);
        
        // Get admin client to bypass RLS for storage upload
        const adminClient = await getAdminSupabaseClient();
        
        // Upload to Supabase storage using admin client
        const { data, error } = await adminClient.storage
          .from(bucketName)
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (error) {
          console.error('❌ Error uploading image:', error);
          throw error;
        }
        
        console.log(`✅ Image uploaded successfully: ${fileName}`);
        return { path: fileName, attribution };
      } catch (fetchError) {
        // Specific handling for fetch errors to determine if retry is useful
        console.error(`❌ Error fetching/uploading image (attempt ${retryCount + 1}):`, fetchError);
        
        // Check if this is a retry-able error
        const isRetryable = fetchError && typeof fetchError === 'object' && (
          // Handle axios error codes
          (fetchError as any).code === 'ECONNABORTED' || 
          (fetchError as any).code === 'ETIMEDOUT' || 
          // Handle HTTP status codes
          ((fetchError as any).response && ((fetchError as any).response.status >= 500 || (fetchError as any).response.status === 429))
        );
        
        if (isRetryable && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = 1000 * retryCount; // Progressive backoff
          console.log(`⏳ Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Try again
        }
        
        // If we've exhausted retries or it's not a retry-able error, return null
        return { path: null, attribution };
      }
    } catch (error) {
      console.error(`❌ Error in downloadAndStorePOIImage (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        continue; // Try again
      }
      
      return { path: null, attribution: null };
    }
  }
  
  // If we've exhausted all retries
  return { path: null, attribution: null };
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
    
    // Prepare location data safely for Prisma - ensure lat/lng are never undefined
    const locationData = {
      lat: poi.geometry.location.lat ?? 0, // Use 0 as fallback if undefined
      lng: poi.geometry.location.lng ?? 0  // Use 0 as fallback if undefined
    };
    
    // Handle opening_hours properly for Prisma
    let openingHoursValue;
    if (poi.details?.opening_hours) {
      // If opening_hours exists, convert to JSON string
      openingHoursValue = JSON.stringify(poi.details.opening_hours);
    } else {
      // If opening_hours is null, use Prisma's DbNull
      openingHoursValue = { DbNull: true };
    }
    
    // Prepare common data values safely for Prisma
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
    const startLocationData = {
      lat: startLocation.lat ?? 0,
      lng: startLocation.lng ?? 0
    };
    
    const endLocationData = {
      lat: endLocation.lat ?? 0,
      lng: endLocation.lng ?? 0
    };
    
    // Generate Google Maps deep link for the full route
    const googleMapsUrl = generateGoogleMapsLink(route, preferences.transportationMode);
    
    // Array to store POI IDs and data for async image processing
    const poisForImageProcessing: { poi: POI; poiId: string }[] = [];
    
    // Start transaction to ensure all core data is saved together (but not images)
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
        }
      });
      
      // 2. Save all POIs
      for (let i = 0; i < route.length; i++) {
        const poi = route[i];
        
        // Skip if this is just a start/end marker without place data
        if (poi.types.includes('starting_point') || poi.types.includes('end_point')) {
          console.log(`Skipping POI as it's a ${poi.types.includes('starting_point') ? 'starting_point' : 'end_point'}`);
          continue;
        }
        
        // Save the POI
        const poiId = await savePOI(poi);
        console.log(`POI saved with ID: ${poiId}`);
        
        // Add to list for async image processing later
        poisForImageProcessing.push({ poi, poiId });
        
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
      
      return tour.id;
    }, {
      timeout: 10000 // Increase transaction timeout to 10 seconds just to be safe
    });
    
    // Now process POI images asynchronously after the transaction completes
    console.log(`Tour created successfully. Now processing ${poisForImageProcessing.length} POI images asynchronously...`);
    
    // Don't await this - let it run in the background
    processPoiImagesAsync(poisForImageProcessing);
    
    return tourId;
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
      console.error('Validation error:', error.message);
      throw new Error(`Invalid data format: ${error.message}`);
    } else {
      throw error;
    }
  }
}

// New function to process POI images asynchronously
async function processPoiImagesAsync(poisData: { poi: POI; poiId: string }[]) {
  try {
    console.log(`Starting async image processing for ${poisData.length} POIs`);
    
    // Process each POI image sequentially to avoid overwhelming resources
    for (const { poi, poiId } of poisData) {
      try {
        console.log(`Processing image for POI: ${poi.name} (${poiId})`);
        
        // First check if POI already has an image stored in database
        const existingPoi = await prisma.poi.findUnique({
          where: { id: poiId },
          select: { thumbnail_url: true }
        });
        
        // Skip image processing if POI already has a thumbnail
        if (existingPoi?.thumbnail_url) {
          console.log(`✅ Skipping image download for POI ${poi.name} - already has image: ${existingPoi.thumbnail_url}`);
          continue; // Skip to next POI
        }
        
        console.log(`🔍 No existing image found for POI ${poi.name}, proceeding with download...`);
        
        // Download and store the image
        const imageResult = await downloadAndStorePOIImage(poi, poiId);
        console.log(`Image download result for ${poi.name}:`, imageResult);
        
        // If we got a result, update the POI record
        if (imageResult.path || imageResult.attribution) {
          // Use raw query to update fields to work around Prisma schema issues
          if (imageResult.path) {
            console.log(`Updating thumbnail_url for POI ${poiId} with path: "${imageResult.path}"`);
            
            try {
              // First verify if the POI exists
              const poiExists = await prisma.poi.findUnique({
                where: { id: poiId }
              });
              
              if (!poiExists) {
                console.error(`Cannot update POI ${poiId} - record not found`);
                continue;
              }
              
              // Update using Prisma's executeRaw to bypass schema validation
              await prisma.$executeRaw`UPDATE "Poi" SET "thumbnail_url" = ${imageResult.path} WHERE id = ${poiId}`;
              
              // Verify the update worked
              const updatedPoi = await prisma.poi.findUnique({
                where: { id: poiId },
                select: { thumbnail_url: true }
              });
              
              console.log(`✅ Thumbnail update result for ${poiId}:`, updatedPoi);
            } catch (dbError) {
              console.error(`❌ Database error updating thumbnail_url for POI ${poiId}:`, dbError);
            }
          }
          
          if (imageResult.attribution) {
            // Only try to update attribution if column exists
            try {
              console.log(`Updating image_attribution for POI ${poiId}`);
              await prisma.$executeRaw`UPDATE "Poi" SET "image_attribution" = ${imageResult.attribution} WHERE id = ${poiId}`;
              console.log(`✅ Updated image_attribution for POI ${poiId}`);
            } catch (attributionError) {
              console.error(`❌ Error updating image_attribution for POI ${poiId}:`, attributionError);
            }
          }
        } else {
          console.log(`⚠️ No image or attribution data to update for POI ${poi.name}`);
        }
      } catch (poiError) {
        // Log error but continue with other POIs
        console.error(`Error processing image for POI ${poi.name}:`, poiError);
      }
    }
    
    console.log('Async POI image processing completed');
  } catch (error) {
    console.error('Error in processPoiImagesAsync:', error);
  }
}

// Modify the checkBucket function to also create the bucket if needed
async function checkBucket() {
  try {
    console.log('🔍 Checking Supabase storage bucket status...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }
    
    console.log(`📦 Found ${buckets.length} buckets:`, buckets.map(b => b.name));
    
    // Check for poi-images bucket
    const poiImagesBucket = buckets.find(b => b.name === 'poi-images');
    if (!poiImagesBucket) {
      console.error('❌ poi-images bucket not found! Attempting to create it...');
      
      // Try to create the bucket
      const { data, error } = await supabase.storage.createBucket('poi-images', {
        public: false, // Keep private for security
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit for images
      });
      
      if (error) {
        console.error('❌ Failed to create poi-images bucket:', error);
        return;
      }
      
      console.log('✅ Successfully created poi-images bucket!');
      return;
    }
    
    // Get bucket details
    console.log('📦 poi-images bucket found:', poiImagesBucket);
    
    // Try to list files to check permissions
    const { data: files, error: filesError } = await supabase.storage
      .from('poi-images')
      .list();
      
    if (filesError) {
      console.error('❌ Error listing files in poi-images bucket:', filesError);
      return;
    }
    
    console.log(`📂 Found ${files.length} files/folders in poi-images bucket`);
    
    // All checks passed
    console.log('✅ Supabase bucket check completed successfully');
  } catch (error) {
    console.error('❌ Unexpected error checking bucket:', error);
  }
}

// Call the check function - add this right after the function definition
checkBucket().catch(console.error); 