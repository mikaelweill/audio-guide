import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { createClient as createServerClient } from '@/utils/supabase/server';

// API endpoint for saving tours
export async function POST(request: NextRequest) {
  try {
    console.log('Tour API: Processing POST request');
    
    // Parse the request body
    const body = await request.json();
    console.log('Tour API: Request body parsed');
    
    // Basic validation
    if (!body.name || !body.route || body.route.length === 0) {
      console.error('Tour API: Missing required fields');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields'
      }, { status: 400 });
    }
    
    // Get the user session using our server client
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      console.error('Tour API: No user authenticated');
      return NextResponse.json({ 
        success: false, 
        error: 'User not authenticated'
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log(`Tour API: Saving tour for user ID ${userId}`);
    
    // Get current timestamp
    const now = new Date().toISOString();
    
    // Destructure preferences and routes from the request body
    const { name, description, preferences, route, stats } = body;
    
    // Use the same supabase client for database operations
    // 1. First create the main Tour record
    const tourId = uuidv4();
    const { error: tourError } = await supabase
      .from('Tour')
      .insert({
        id: tourId,
        user_id: userId,
        name,
        description: description || '',
        created_at: now,
        last_updated_at: now,
        start_location: preferences.startLocation,
        end_location: preferences.endLocation,
        return_to_start: preferences.returnToStart,
        transportation_mode: preferences.transportationMode,
        total_distance: stats?.distance || preferences.distance,
        total_duration: stats?.duration || preferences.duration * 60, // convert minutes to seconds
        preferences: {
          interests: preferences.interests
        }
      });
    
    if (tourError) {
      console.error('Tour API: Error creating tour record:', tourError);
      return NextResponse.json({ 
        success: false, 
        error: tourError.message 
      }, { status: 500 });
    }
    
    // 2. Process POIs for the tour
    // For each POI in the route, check if it exists in the Poi table
    // If not, create it, then create the TourPoi relation
    if (route.length > 0) {
      for (let i = 0; i < route.length; i++) {
        const poi = route[i];
        
        // Check if POI exists
        const { data: existingPoi } = await supabase
          .from('Poi')
          .select('id')
          .eq('place_id', poi.place_id)
          .single();
        
        let poiId;
        
        if (!existingPoi) {
          // POI doesn't exist, create it
          const newPoiId = uuidv4();
          const { error: poiError } = await supabase
            .from('Poi')
            .insert({
              id: newPoiId,
              place_id: poi.place_id,
              name: poi.name,
              formatted_address: poi.vicinity || 'Unknown',
              location: poi.geometry?.location || { lat: 0, lng: 0 },
              types: poi.types || [],
              rating: poi.rating,
              photo_references: poi.photos ? poi.photos.map((photo: any) => photo.photo_reference) : [],
              last_updated_at: now
            });
          
          if (poiError) {
            console.error(`Tour API: Error creating POI record for ${poi.name}:`, poiError);
            // Continue anyway to try creating other POIs
          } else {
            poiId = newPoiId;
          }
        } else {
          poiId = existingPoi.id;
        }
        
        if (poiId) {
          // Create TourPoi relation
          const { error: tourPoiError } = await supabase
            .from('TourPoi')
            .insert({
              id: uuidv4(),
              tour_id: tourId,
              poi_id: poiId,
              sequence_number: i,
              // You could calculate distance_to_next and time_to_next here
              // if you have that data
            });
          
          if (tourPoiError) {
            console.error(`Tour API: Error creating TourPoi relation for tour ${tourId} and POI ${poiId}:`, tourPoiError);
          }
        }
      }
    }
    
    console.log('Tour API: Tour saved successfully:', tourId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tour saved successfully',
      tourId: tourId
    }, { status: 201 });
  } catch (error) {
    console.error('Tour API: Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 