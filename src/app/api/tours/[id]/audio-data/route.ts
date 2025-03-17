import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Standard async function, not a generator
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    // Extract tourId from context to avoid the Next.js params warning
    const tourId = context.params?.id;
    console.log('Using tourId from context:', tourId);
    
    if (!tourId) {
      console.error('Tour ID not found in request');
      return NextResponse.json({ success: false, error: "Tour ID is required" }, { status: 400 });
    }

    // Create supabase client and await it
    const supabase = await createClient();

    // Get the tour to verify it exists
    const { data: tour, error: tourError } = await supabase
      .from('Tour')
      .select('id, name')
      .eq('id', tourId)
      .single();

    if (tourError) {
      console.error('Tour not found error:', tourError);
      return NextResponse.json({ success: false, error: "Tour not found" }, { status: 404 });
    }

    if (!tour) {
      console.error('Tour not found with ID:', tourId);
      return NextResponse.json({ success: false, error: "Tour not found" }, { status: 404 });
    }

    console.log('Found tour:', tour.name);

    // Get all POIs for the tour
    const { data: tourPois, error: poisError } = await supabase
      .from('TourPoi')
      .select('id, poi_id, sequence_number, poi:Poi(id, name)')
      .eq('tour_id', tourId)
      .order('sequence_number');

    if (poisError) {
      console.error('Failed to fetch POIs:', poisError);
      return NextResponse.json({ success: false, error: "Failed to fetch POIs" }, { status: 500 });
    }

    console.log(`Found ${tourPois.length} POIs for tour`);

    // Get audio data for all POIs from the Translation table
    const poiIds = tourPois.map((tp: { poi_id: string }) => tp.poi_id);
    console.log('POI IDs to fetch audio for:', poiIds);
    
    if (poiIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        tourId,
        audioData: {}
      });
    }
    
    // Get audio data from the Translation table
    const { data: translationData, error: translationError } = await supabase
      .from('Translation')
      .select('poi_id, content_type, language_code, audio_path')
      .in('poi_id', poiIds)
      .in('content_type', ['brief', 'detailed', 'complete']) // Filter to only audio content types
      .eq('language_code', 'en'); // Default to English for now
      
    if (translationError) {
      console.error('Failed to fetch translation data:', translationError);
      return NextResponse.json({ 
        success: true, // Still return success to allow download to proceed
        tourId,
        audioData: {},
        warning: "Failed to fetch audio data from translations"
      });
    }

    console.log(`Found translation data for ${translationData?.length || 0} entries`);

    // Format the audio data as a map of POI ID -> audio files
    const formattedAudioData: Record<string, { brief: string; detailed: string; complete: string }> = {};
    
    // Initialize all POIs with empty audio paths
    poiIds.forEach(poiId => {
      formattedAudioData[poiId] = {
        brief: '',
        detailed: '',
        complete: ''
      };
    });
    
    // Fill in the available audio paths
    if (translationData) {
      translationData.forEach((translation: { poi_id: string; content_type: string; audio_path: string | null }) => {
        if (translation.audio_path && formattedAudioData[translation.poi_id]) {
          // Only update if the content_type is one of our expected types and audio_path exists
          if (['brief', 'detailed', 'complete'].includes(translation.content_type)) {
            formattedAudioData[translation.poi_id][translation.content_type as 'brief' | 'detailed' | 'complete'] = 
              translation.audio_path;
          }
        }
      });
    }

    console.log('Audio data formatted successfully');
    return NextResponse.json({ 
      success: true, 
      tourId,
      audioData: formattedAudioData
    });
  } catch (error) {
    console.error('Error in audio-data route:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Internal server error",
      audioData: {} // Return empty audio data even on error
    }, { status: 200 }); // Return 200 with error info rather than 500
  }
} 