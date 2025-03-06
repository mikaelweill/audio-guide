import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Tour API: Fetching tour with ID ${params.id}`);
    
    // Get the user session using our server client
    console.log('Tour API: Creating Supabase client');
    const supabase = createServerClient();
    
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
    const tourId = params.id;
    
    console.log(`Tour API: Fetching tour ID ${tourId} for user ID ${userId}`);
    
    // Try using Prisma first
    try {
      console.log('Tour API: Attempting to fetch tour with Prisma');
      const tour = await prisma.tour.findFirst({
        where: {
          id: tourId,
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
        }
      });
      
      if (!tour) {
        console.log(`Tour API: Tour with ID ${tourId} not found or does not belong to user ${userId}`);
        return NextResponse.json({ 
          success: false, 
          error: 'Tour not found' 
        }, { status: 404 });
      }
      
      console.log(`Tour API: Found tour with Prisma`);
      
      return NextResponse.json({ 
        success: true, 
        tour
      }, { status: 200 });
    } catch (prismaError) {
      console.error('Tour API: Error fetching tour with Prisma:', prismaError);
      
      // Fallback to Supabase query if Prisma fails
      console.log('Tour API: Falling back to Supabase query');
      
      // Get tour with tourPois and pois
      const { data: tour, error } = await supabase
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
          tourPois (
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
        .eq('id', tourId)
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`Tour API: Tour with ID ${tourId} not found or does not belong to user ${userId}`);
          return NextResponse.json({ 
            success: false, 
            error: 'Tour not found' 
          }, { status: 404 });
        }
        
        console.error('Tour API: Error fetching tour with Supabase:', error);
        return NextResponse.json({ 
          success: false, 
          error: error.message 
        }, { status: 500 });
      }
      
      if (!tour) {
        console.log(`Tour API: Tour with ID ${tourId} not found or does not belong to user ${userId}`);
        return NextResponse.json({ 
          success: false, 
          error: 'Tour not found' 
        }, { status: 404 });
      }
      
      console.log(`Tour API: Found tour with Supabase`);
      
      return NextResponse.json({ 
        success: true, 
        tour
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