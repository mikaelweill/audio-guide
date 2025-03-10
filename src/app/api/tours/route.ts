import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { createClient as createServerClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { createTour } from '@/services/tourService';

// API endpoint for getting tours by user
export async function GET(request: NextRequest) {
  try {
    console.log('Tour API: Processing GET request');
    
    // Get the user session using our server client
    console.log('Tour API: Creating Supabase client');
    const supabase = await createServerClient();
    
    // Fetch the session
    console.log('Tour API: Fetching session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Tour API: Error getting session:', sessionError);
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication error' 
      }, { status: 401 });
    }
    
    if (!session?.user?.id) {
      console.error('Tour API: No user authenticated');
      return NextResponse.json({ 
        success: false, 
        error: 'User not authenticated'
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log(`Tour API: Fetching tours for user ID ${userId}`);
    
    // Try using Prisma instead of Supabase direct query
    try {
      console.log('Tour API: Attempting to fetch tours with Prisma');
      const tours = await prisma.tour.findMany({
        where: {
          user_id: userId
        },
        include: {
          tourPois: {
            include: {
              poi: true
            },
            orderBy: {
              sequence_number: 'asc'
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });
      
      console.log(`Tour API: Found ${tours?.length || 0} tours with Prisma`);
      
      return NextResponse.json({ 
        success: true, 
        tours
      }, { status: 200 });
    } catch (prismaError) {
      console.error('Tour API: Error fetching tours with Prisma:', prismaError);
      
      // Fallback to Supabase query if Prisma fails
      console.log('Tour API: Falling back to Supabase query');
      
      // Query tours for the user
      const { data: tours, error } = await supabase
        .from('Tour')
        .select(`
          id, 
          name, 
          description,
          created_at,
          last_updated_at,
          start_location, 
          end_location,
          return_to_start,
          transportation_mode,
          total_distance,
          total_duration,
          google_maps_url,
          TourPoi (
            id,
            sequence_number,
            poi:Poi (
              id,
              name,
              formatted_address,
              location,
              types,
              rating,
              photo_references
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Tour API: Error fetching tours with Supabase:', error);
        return NextResponse.json({ 
          success: false, 
          error: error.message 
        }, { status: 500 });
      }
      
      console.log(`Tour API: Found ${tours?.length || 0} tours with Supabase`);
      
      return NextResponse.json({ 
        success: true, 
        tours
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Tour API: Unexpected error:', error);
    if (error instanceof Error) {
      console.error('Tour API: Error details:', error.message);
      console.error('Tour API: Error stack:', error.stack);
    }
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// API endpoint for saving tours
export async function POST(request: NextRequest) {
  try {
    console.log('Tour API: Processing POST request');
    
    // Parse the request body
    const body = await request.json();
    console.log('Tour API: Request body parsed');
    
    // Basic validation - make sure we have the required fields
    if (!body.name || !body.preferences || !body.route || !Array.isArray(body.route)) {
      console.error('Tour API: Invalid request body:', 
        JSON.stringify({
          hasName: !!body.name,
          hasPreferences: !!body.preferences,
          hasRoute: !!body.route,
          routeIsArray: Array.isArray(body.route)
        })
      );
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: name, preferences, route' 
      }, { status: 400 });
    }
    
    // Get the user session using our server client
    const supabase = await createServerClient();
    
    // Fetch the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Tour API: Error getting session:', sessionError);
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication error' 
      }, { status: 401 });
    }
    
    if (!session?.user?.id) {
      console.error('Tour API: No user authenticated');
      return NextResponse.json({ 
        success: false, 
        error: 'User not authenticated'
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log(`Tour API: Saving tour for user ID ${userId}`);
    
    // Destructure preferences and routes from the request body
    const { name, description, preferences, route, stats } = body;

    // Use the createTour function which includes image downloading and storing
    try {
      const tourId = await createTour({
        userId,
        name,
        description: description || '',
        route,
        preferences,
        stats: stats || {}
      });
      
      console.log(`Tour API: Tour saved successfully: ${tourId}`);
      return NextResponse.json({ 
        success: true, 
        tourId 
      }, { status: 201 });
    } catch (error) {
      console.error('Tour API: Error saving tour using createTour function:', error);
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error saving tour'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Tour API: Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error'
    }, { status: 500 });
  }
} 