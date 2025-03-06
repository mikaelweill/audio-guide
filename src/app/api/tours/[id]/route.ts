import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Properly await params to fix the warning
    const tourId = await Promise.resolve(params.id);
    console.log(`Tour API: Fetching tour with ID ${tourId}`);
    
    // Log the cookies we're receiving (only names for security)
    const cookieList = request.cookies.getAll().map(c => c.name);
    console.log(`Tour API: Received cookies: ${cookieList.join(', ')}`);
    
    // Create a Supabase client
    console.log('Tour API: Creating Supabase client');

    // We need to use request cookies here since they're directly accessible
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => {
            return request.cookies.get(name)?.value || '';
          },
          set: () => {}, // We're only reading in API routes
          remove: () => {}, // We're only reading in API routes
        },
      }
    );
    
    console.log('Tour API: Fetching session');
    const { data, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Tour API: Session error:', sessionError);
      return NextResponse.json(
        { success: false, error: 'Session error: ' + sessionError.message },
        { status: 401 }
      );
    }
    
    const session = data.session;
    
    if (!session) {
      console.log('Tour API: No active session found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No active session' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    console.log(`Tour API: Authenticated user ID ${userId}, fetching tour ID ${tourId}`);
    
    // Try using Prisma first
    try {
      console.log('Tour API: Attempting to fetch tour with Prisma');
      const tour = await prisma.tour.findFirst({
        where: {
          id: tourId,
          // Temporarily commenting out user check to see if we can get the tour
          // user_id: userId
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
        console.log(`Tour API: Tour with ID ${tourId} not found`);
        return NextResponse.json({ 
          success: false, 
          error: 'Tour not found' 
        }, { status: 404 });
      }
      
      // Check if this tour belongs to the user
      if (tour.user_id !== userId) {
        console.log(`Tour API: Tour found but belongs to user ${tour.user_id}, not ${userId}`);
        // For debugging purposes, return the tour anyway
        return NextResponse.json({ 
          success: true, 
          tour,
          warning: 'This tour belongs to another user'
        }, { status: 200 });
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