import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('API: Fetch existing audio guides endpoint called');
  
  try {
    // Get request body
    const body = await request.json();
    const { poiIds } = body;
    
    if (!poiIds || !Array.isArray(poiIds) || poiIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing or invalid poiIds' 
      }, { status: 400 });
    }
    
    console.log(`API: Fetching audio guides for ${poiIds.length} POIs`);
    
    // Create Supabase client
    const cookieStore = cookies();
    
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
    
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('API: No active session found for audio guide fetch');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - No active session' 
      }, { status: 401 });
    }
    
    // Format the response object by POI ID
    const audioGuides: Record<string, any> = {};
    
    // Fetch audio guides directly from the Poi table for each POI
    for (const poiId of poiIds) {
      console.log(`API: Checking for audio guides for POI: ${poiId}`);
      
      // Query the Poi table directly where the audio data is stored
      const { data: poiData, error } = await supabase
        .from('Poi')
        .select(`
          id,
          name,
          formatted_address,
          brief_transcript,
          detailed_transcript,
          complete_transcript,
          brief_audio_url,
          detailed_audio_url,
          complete_audio_url,
          audio_generated_at
        `)
        .eq('id', poiId)
        .single();
      
      if (error) {
        console.error(`API: Error fetching audio guide for POI: ${poiId}`, error);
        continue;
      }
      
      if (poiData && (poiData.brief_audio_url || poiData.detailed_audio_url || poiData.complete_audio_url)) {
        console.log(`API: Found audio guide for POI: ${poiId}`);
        
        // Format the data for the frontend
        const audioFiles: Record<string, string> = {};
        
        if (poiData.brief_audio_url) {
          audioFiles.coreAudioUrl = poiData.brief_audio_url;
        }
        
        if (poiData.detailed_audio_url) {
          audioFiles.secondaryAudioUrl = poiData.detailed_audio_url;
        }
        
        if (poiData.complete_audio_url) {
          audioFiles.tertiaryAudioUrl = poiData.complete_audio_url;
        }
        
        // Only add to response if there are audio files
        if (Object.keys(audioFiles).length > 0) {
          audioGuides[poiId] = {
            name: poiData.name || 'Audio Guide',
            content: {
              brief: poiData.brief_transcript,
              detailed: poiData.detailed_transcript,
              complete: poiData.complete_transcript
            },
            audioFiles: audioFiles,
            generated_at: poiData.audio_generated_at
          };
        }
      } else {
        console.log(`API: No audio guide found for POI: ${poiId}`);
      }
    }
    
    // Return the results
    const hasAudioGuides = Object.keys(audioGuides).length > 0;
    console.log(`API: Returning ${Object.keys(audioGuides).length} audio guides`);
    
    return NextResponse.json({
      success: true,
      audioGuides,
      hasAudioGuides
    });
    
  } catch (error) {
    console.error('API: Error in fetch-existing audio guides:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 