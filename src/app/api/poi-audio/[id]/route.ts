import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const poiId = params.id;
    
    if (!poiId) {
      return NextResponse.json(
        { error: 'Missing POI ID parameter' },
        { status: 400 }
      );
    }
    
    console.log(`Fetching audio data for POI: ${poiId}`);
    
    // Query the database for the POI audio data
    const poi = await prisma.poi.findUnique({
      where: {
        id: poiId
      },
      select: {
        id: true,
        name: true,
        brief_audio_url: true,
        detailed_audio_url: true,
        complete_audio_url: true,
        brief_transcript: true,
        detailed_transcript: true,
        complete_transcript: true,
        audio_generated_at: true
      }
    });
    
    if (!poi) {
      return NextResponse.json(
        { error: 'POI not found' },
        { status: 404 }
      );
    }
    
    // If the POI doesn't have audio data yet, return a not found message
    if (!poi.brief_audio_url && !poi.detailed_audio_url && !poi.complete_audio_url) {
      return NextResponse.json(
        { error: 'No audio data available for this POI' },
        { status: 404 }
      );
    }
    
    // Format the response to match what the UI expects
    const audioData = {
      name: poi.name,
      audioFiles: {
        coreAudioUrl: poi.brief_audio_url,
        secondaryAudioUrl: poi.detailed_audio_url,
        tertiaryAudioUrl: poi.complete_audio_url
      },
      content: {
        core: poi.brief_transcript,
        secondary: poi.detailed_transcript,
        tertiary: poi.complete_transcript
      },
      generatedAt: poi.audio_generated_at
    };
    
    return NextResponse.json(audioData);
  } catch (error: any) {
    console.error('Error fetching POI audio data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POI audio data', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 