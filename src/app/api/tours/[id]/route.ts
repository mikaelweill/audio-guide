import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('⭐️ Tour ID API: Request started');
  console.time('tour-api-timer');
  
  try {
    // Properly await params to fix the warning
    const tourId = await Promise.resolve(params.id);
    console.log(`⭐️ Tour ID API: Fetching tour with ID ${tourId}`);
    
    // Log the cookies we're receiving (only names for security)
    const cookieList = request.cookies.getAll().map(c => c.name);
    console.log(`⭐️ Tour ID API: Received cookies: ${cookieList.join(', ')}`);
    
    // Validate tour ID
    if (!tourId) {
      console.error('⭐️ Tour ID API: No tour ID provided');
      return NextResponse.json({ 
        success: false, 
        error: 'No tour ID provided' 
      }, { status: 400 });
    }
    
    // Create a Supabase client
    console.log('⭐️ Tour ID API: Creating Supabase client');
    try {
      console.time('supabase-client-creation');
      const supabase = await createClient();
      console.timeEnd('supabase-client-creation');
      
      console.log('⭐️ Tour ID API: Fetching session');
      console.time('session-fetch');
      const { data, error: sessionError } = await supabase.auth.getSession();
      console.timeEnd('session-fetch');
      
      if (sessionError) {
        console.error('⭐️ Tour ID API: Session error:', sessionError);
        return NextResponse.json(
          { success: false, error: 'Session error: ' + sessionError.message },
          { status: 401 }
        );
      }
      
      const session = data.session;
      
      if (!session) {
        console.log('⭐️ Tour ID API: No active session found');
        return NextResponse.json(
          { success: false, error: 'Unauthorized - No active session' },
          { status: 401 }
        );
      }
      
      const userId = session.user.id;
      
      console.log(`⭐️ Tour ID API: Authenticated user ID ${userId}, fetching tour ID ${tourId}`);
      
      // Try using Prisma directly without fallbacks
      try {
        console.log('⭐️ Tour ID API: Fetching tour with Prisma - START');
        console.time('prisma-fetch');
        
        // First, just check if the tour exists at all
        const tourExists = await prisma.tour.findUnique({
          where: { id: tourId },
          select: { id: true }
        });
        
        console.log(`⭐️ Tour ID API: Tour exists check: ${!!tourExists}`);
        
        if (!tourExists) {
          console.log(`⭐️ Tour ID API: Tour with ID ${tourId} not found`);
          console.timeEnd('tour-api-timer');
          return NextResponse.json({ 
            success: false, 
            error: 'Tour not found' 
          }, { status: 404 });
        }
        
        // Now fetch the full tour with related data
        const tour = await prisma.tour.findFirst({
          where: {
            id: tourId,
            // Including user check now
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
        
        console.timeEnd('prisma-fetch');
        console.log('⭐️ Tour ID API: Prisma fetch completed');
        
        if (!tour) {
          console.log(`⭐️ Tour ID API: Tour with ID ${tourId} not found or not owned by user ${userId}`);
          console.timeEnd('tour-api-timer');
          return NextResponse.json({ 
            success: false, 
            error: 'Tour not found or you do not have permission to access it' 
          }, { status: 404 });
        }
        
        console.log(`⭐️ Tour ID API: Found tour with Prisma, returning data`);
        console.timeEnd('tour-api-timer');
        
        return NextResponse.json({ 
          success: true, 
          tour
        }, { status: 200 });
        
      } catch (prismaError) {
        console.error('⭐️ Tour ID API: Error fetching tour with Prisma:', prismaError);
        console.timeEnd('tour-api-timer');
        
        return NextResponse.json({ 
          success: false, 
          error: 'Database error: ' + (prismaError instanceof Error ? prismaError.message : 'Unknown error')
        }, { status: 500 });
      }
    } catch (supabaseError) {
      console.error('⭐️ Tour ID API: Error creating Supabase client:', supabaseError);
      console.timeEnd('tour-api-timer');
      return NextResponse.json({ 
        success: false, 
        error: 'Error creating authentication client' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('⭐️ Tour ID API: Unexpected error:', error);
    if (error instanceof Error) {
      console.error('⭐️ Tour ID API: Error details:', error.message);
      console.error('⭐️ Tour ID API: Error stack:', error.stack);
    }
    console.timeEnd('tour-api-timer');
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 