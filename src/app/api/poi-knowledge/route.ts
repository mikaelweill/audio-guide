import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// API endpoint to fetch POI knowledge directly
export async function POST(request: NextRequest) {
  console.log('POI Knowledge API: Request started');
  
  try {
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('POI Knowledge API: Invalid request body');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body' 
      }, { status: 400 });
    }
    
    // Validate input
    const { poiId } = body;
    if (!poiId) {
      console.error('POI Knowledge API: No POI ID provided');
      return NextResponse.json({ 
        success: false, 
        error: 'POI ID is required' 
      }, { status: 400 });
    }
    
    console.log(`POI Knowledge API: Fetching knowledge for POI ID ${poiId}`);
    
    // Fetch POI with its knowledge
    const poiWithKnowledge = await prisma.poi.findUnique({
      where: { id: poiId },
      include: {
        poi_knowledge: true
      }
    });
    
    if (!poiWithKnowledge) {
      console.log(`POI Knowledge API: POI with ID ${poiId} not found`);
      return NextResponse.json({ 
        success: false, 
        error: 'POI not found' 
      }, { status: 404 });
    }
    
    // Extract the knowledge data
    const knowledge = poiWithKnowledge.poi_knowledge;
    
    // Return the POI knowledge
    console.log(`POI Knowledge API: Successfully retrieved knowledge for POI ${poiId}`);
    return NextResponse.json({ 
      success: true, 
      knowledge
    }, { status: 200 });
    
  } catch (error) {
    console.error('POI Knowledge API: Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 