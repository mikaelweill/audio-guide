import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateSignedUrl } from '@/utils/storage-helpers';

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
    const supabase = await createClient();
    
    // Get session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('API: No active session found for audio guide fetch');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - No active session' 
      }, { status: 401 });
    }
    
    // Get user's preferred language
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('preferred_language')
      .eq('id', session.user.id)
      .single();
      
    if (userError) {
      console.error('API: Error fetching user language preference:', userError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve language preference' 
      }, { status: 500 });
    }
    
    const preferredLanguage = userData?.preferred_language || 'en';
    console.log(`API: User preferred language: ${preferredLanguage}`);
    
    // Format the response object by POI ID
    const audioGuides: Record<string, any> = {};
    
    // Process each POI
    for (const poiId of poiIds) {
      console.log(`API: Checking for audio guides for POI: ${poiId} in language: ${preferredLanguage}`);
      
      // First, get basic POI info
      const { data: poiData, error: poiError } = await supabase
        .from('Poi')
        .select(`
          id,
          name,
          formatted_address,
          audio_generated_at
        `)
        .eq('id', poiId)
        .single();
        
      if (poiError) {
        console.error(`API: Error fetching POI data for: ${poiId}`, poiError);
        continue;
      }
      
      // Now fetch translations in the preferred language
      const { data: translations, error: translationError } = await supabase
        .from('Translation')
        .select(`
          content_type,
          translated_text,
          audio_path,
          language_code
        `)
        .eq('poi_id', poiId)
        .eq('language_code', preferredLanguage);
      
      if (translationError) {
        console.error(`API: Error fetching translations for POI: ${poiId}`, translationError);
        continue;
      }
      
      // If no translations found in preferred language, fall back to English
      let finalTranslations = translations;
      
      if (!translations || translations.length === 0) {
        console.log(`API: No translations found in ${preferredLanguage}, falling back to English`);
        
        const { data: englishTranslations, error: engError } = await supabase
          .from('Translation')
          .select(`
            content_type,
            translated_text,
            audio_path,
            language_code
          `)
          .eq('poi_id', poiId)
          .eq('language_code', 'en');
          
        if (engError) {
          console.error(`API: Error fetching English translations for POI: ${poiId}`, engError);
          continue;
        }
        
        finalTranslations = englishTranslations;
        
        // If English content exists and we need a different language, trigger translation
        if (englishTranslations && englishTranslations.length > 0 && preferredLanguage !== 'en') {
          console.log(`API: Triggering async translation from English to ${preferredLanguage}`);
          
          try {
            // Call the translation edge function asynchronously (don't await)
            fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate-content`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({
                poiId,
                targetLanguage: preferredLanguage,
                sourceLanguageCode: 'en'
              })
            }).catch(err => {
              // Just log errors, don't block the response
              console.error('Error triggering translation:', err);
            });
            
            // Add a flag to indicate translation is in progress
            englishTranslations.forEach(translation => {
              translation.translationInProgress = true;
            });
          } catch (err) {
            console.error('Error initiating translation:', err);
          }
        }
      }
      
      // If we still don't have translations, check if there are legacy transcripts in the POI table
      if (!finalTranslations || finalTranslations.length === 0) {
        console.log(`API: No translations found in translation table, checking legacy POI fields`);
        
        const { data: legacyData, error: legacyError } = await supabase
          .from('Poi')
          .select(`
            brief_transcript,
            detailed_transcript,
            complete_transcript,
            brief_audio_path,
            detailed_audio_path,
            complete_audio_path
          `)
          .eq('id', poiId)
          .single();
          
        if (legacyError) {
          console.error(`API: Error fetching legacy transcript data for POI: ${poiId}`, legacyError);
          continue;
        }
        
        // If we found legacy data with audio paths, process it
        if (legacyData && (legacyData.brief_audio_path || legacyData.detailed_audio_path || legacyData.complete_audio_path)) {
          // Format the data for the frontend
          const audioFiles: Record<string, string> = {};
          const content: Record<string, string> = {};
          
          // Process brief content
          if (legacyData.brief_audio_path) {
            const signedUrl = await generateSignedUrl(legacyData.brief_audio_path);
            if (signedUrl) {
              audioFiles.coreAudioUrl = signedUrl;
              content.brief = legacyData.brief_transcript || '';
            }
          }
          
          // Process detailed content
          if (legacyData.detailed_audio_path) {
            const signedUrl = await generateSignedUrl(legacyData.detailed_audio_path);
            if (signedUrl) {
              audioFiles.secondaryAudioUrl = signedUrl;
              content.detailed = legacyData.detailed_transcript || '';
            }
          }
          
          // Process complete content
          if (legacyData.complete_audio_path) {
            const signedUrl = await generateSignedUrl(legacyData.complete_audio_path);
            if (signedUrl) {
              audioFiles.tertiaryAudioUrl = signedUrl;
              content.complete = legacyData.complete_transcript || '';
            }
          }
          
          // Only add to response if there are audio files
          if (Object.keys(audioFiles).length > 0) {
            audioGuides[poiId] = {
              name: poiData.name || 'Audio Guide',
              content,
              audioFiles,
              generated_at: poiData.audio_generated_at,
              language: 'en' // Legacy data is always English
            };
          }
        }
        
        // Continue to the next POI if we've processed legacy data
        continue;
      }
      
      // Process the translations we found
      const audioFiles: Record<string, string> = {};
      const content: Record<string, string> = {};
      
      // Group translations by content type
      for (const translation of finalTranslations) {
        // Skip translations without audio path
        if (!translation.audio_path) continue;
        
        // Generate signed URL for audio path
        const signedUrl = await generateSignedUrl(translation.audio_path);
        if (!signedUrl) continue;
        
        // Map content types to frontend keys
        if (translation.content_type === 'brief') {
          audioFiles.coreAudioUrl = signedUrl;
          content.brief = translation.translated_text || '';
        } else if (translation.content_type === 'detailed') {
          audioFiles.secondaryAudioUrl = signedUrl;
          content.detailed = translation.translated_text || '';
        } else if (translation.content_type === 'complete') {
          audioFiles.tertiaryAudioUrl = signedUrl;
          content.complete = translation.translated_text || '';
        }
      }
      
      // Only add to response if there are audio files
      if (Object.keys(audioFiles).length > 0) {
        audioGuides[poiId] = {
          name: poiData.name || 'Audio Guide',
          content,
          audioFiles,
          generated_at: poiData.audio_generated_at,
          language: finalTranslations[0]?.language_code || 'en'
        };
      } else {
        console.log(`API: No audio files found for POI: ${poiId}`);
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