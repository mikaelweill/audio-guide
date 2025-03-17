import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tourId = params.id;
    if (!tourId) {
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

    if (tourError || !tour) {
      return NextResponse.json({ success: false, error: "Tour not found" }, { status: 404 });
    }

    // Get all POIs for the tour
    const { data: tourPois, error: poisError } = await supabase
      .from('TourPoi')
      .select('id, poi_id, sequence_number, poi:Poi(id, name)')
      .eq('tour_id', tourId)
      .order('sequence_number');

    if (poisError) {
      return NextResponse.json({ success: false, error: "Failed to fetch POIs" }, { status: 500 });
    }

    // Get audio data for all POIs
    const poiIds = tourPois.map((tp: { poi_id: string }) => tp.poi_id);
    
    const { data: audioData, error: audioError } = await supabase
      .from('PoiAudio')
      .select('poi_id, brief, detailed, complete')
      .in('poi_id', poiIds);

    if (audioError) {
      return NextResponse.json({ success: false, error: "Failed to fetch audio data" }, { status: 500 });
    }

    // Format the audio data as a map of POI ID -> audio files
    const formattedAudioData: Record<string, { brief: string; detailed: string; complete: string }> = {};
    
    audioData.forEach((audio: { poi_id: string; brief: string; detailed: string; complete: string }) => {
      formattedAudioData[audio.poi_id] = {
        brief: audio.brief || '',
        detailed: audio.detailed || '',
        complete: audio.complete || ''
      };
    });

    return NextResponse.json({ 
      success: true, 
      tourId,
      audioData: formattedAudioData
    });
  } catch (error) {
    console.error('Error fetching audio data:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
} 