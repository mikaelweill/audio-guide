import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const poiId = params.id;
    
    console.log(`Fetching audio data for POI ID: ${poiId}`);
    
    // For demonstration, we'll return mock data
    // In a real app, this would query a database
    
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return mock data
    return NextResponse.json({
      id: poiId,
      name: `Point of Interest ${poiId.slice(0, 5)}`,
      audioUrl: `https://storage.googleapis.com/your-bucket/audio/${poiId}.mp3`,
      transcript: `This is a transcript for point of interest ${poiId.slice(0, 5)}.
      
It includes detailed information about this location, its historical significance, and cultural context.

Visitors particularly enjoy the architectural elements and the surrounding atmosphere.`,
      language: 'English',
      translationInProgress: Math.random() > 0.8 // Randomly show translation in progress for demo
    });
  } catch (error) {
    console.error('Error fetching POI audio data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audio data' },
      { status: 500 }
    );
  }
} 