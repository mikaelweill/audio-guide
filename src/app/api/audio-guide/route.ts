/**
 * Audio Guide API Endpoints
 * 
 * Handles generation and retrieval of audio guides for POIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';
import audioGuideController, { VoiceOption } from '@/services/audioGuide';

/**
 * GET: Retrieve audio guide for a POI
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient<Database>();
    
    // Get the POI ID from the query string
    const searchParams = request.nextUrl.searchParams;
    const poiId = searchParams.get('poiId');
    
    if (!poiId) {
      return NextResponse.json(
        { error: 'POI ID is required' },
        { status: 400 }
      );
    }
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Query the database for existing audio guide records
    const { data: audioGuideData, error } = await supabase
      .from('poi_audio')
      .select('*')
      .eq('poi_id', poiId)
      .maybeSingle();
    
    if (error) {
      return NextResponse.json(
        { error: 'Error retrieving audio guide data' },
        { status: 500 }
      );
    }
    
    // If audio guide exists, return it
    if (audioGuideData) {
      return NextResponse.json({ audioGuide: audioGuideData });
    } else {
      // No existing audio guide found
      return NextResponse.json(
        { message: 'No audio guide found for this POI' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error in GET audio guide:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Generate a new audio guide for a POI
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient<Database>();
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const requestData = await request.json();
    const { poi, voice = 'nova' } = requestData;
    
    if (!poi || !poi.id || !poi.name) {
      return NextResponse.json(
        { error: 'Invalid POI data. Must include id and name.' },
        { status: 400 }
      );
    }
    
    // Check if an audio guide already exists for this POI
    const { data: existingAudio } = await supabase
      .from('poi_audio')
      .select('id')
      .eq('poi_id', poi.id)
      .maybeSingle();
    
    // Generate audio guide
    const result = await audioGuideController.generateAudioGuideForPoi(
      poi,
      voice as VoiceOption
    );
    
    // Store the result in the database
    const audioGuideRecord = {
      poi_id: result.poiId,
      core_audio_url: result.audioFiles.coreAudioUrl,
      secondary_audio_url: result.audioFiles.secondaryAudioUrl,
      tertiary_audio_url: result.audioFiles.tertiaryAudioUrl,
      sources: result.sources,
      quality_score: result.qualityScore,
      voice: voice
    };
    
    let dbResult;
    
    if (existingAudio) {
      // Update existing record
      const { data, error } = await supabase
        .from('poi_audio')
        .update(audioGuideRecord)
        .eq('id', existingAudio.id)
        .select()
        .single();
      
      if (error) throw error;
      dbResult = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('poi_audio')
        .insert(audioGuideRecord)
        .select()
        .single();
      
      if (error) throw error;
      dbResult = data;
    }
    
    return NextResponse.json({
      success: true,
      audioGuide: dbResult,
      content: result.content
    });
  } catch (error) {
    console.error('Error generating audio guide:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio guide' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove an audio guide for a POI
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient<Database>();
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the POI ID from the query string
    const searchParams = request.nextUrl.searchParams;
    const poiId = searchParams.get('poiId');
    
    if (!poiId) {
      return NextResponse.json(
        { error: 'POI ID is required' },
        { status: 400 }
      );
    }
    
    // Delete the record from the database
    const { error } = await supabase
      .from('poi_audio')
      .delete()
      .eq('poi_id', poiId);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete audio guide' },
        { status: 500 }
      );
    }
    
    // Note: This doesn't delete the actual audio files from storage
    // In a production app, you might want to add storage cleanup
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting audio guide:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 