import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import OpenAI from 'https://esm.sh/openai@4.16.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

// Main handler for the function
serve(async (req: Request) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  try {
    const { poiData, poisArray } = await req.json();
    
    // Handle either a single POI or an array of POIs
    if (poisArray && Array.isArray(poisArray) && poisArray.length > 0) {
      console.log(`Processing ${poisArray.length} POIs in parallel`);
      
      // Process multiple POIs in parallel
      const results = await Promise.all(
        poisArray.map(async (poi) => {
          try {
            const result = await processPOI(poi);
            return { 
              poiId: poi.id || poi.place_id,
              success: true, 
              result 
            };
          } catch (error: any) {
            console.error(`Error processing POI ${poi.id || poi.place_id}:`, error);
            return { 
              poiId: poi.id || poi.place_id,
              success: false, 
              error: error.message 
            };
          }
        })
      );
      
      return new Response(
        JSON.stringify({ success: true, results }),
        {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } 
    // Handle single POI (backwards compatibility)
    else if (poiData) {
      const result = await processPOI(poiData);
      return new Response(
        JSON.stringify({ success: true, result }),
        {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } 
    else {
      throw new Error("No valid POI data provided");
    }
  } catch (error: any) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error",
        stack: error.stack
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

// Function to process a single POI
async function processPOI(poiData: any) {
  try {
    // Extract the place_id (Google Place ID) from the input data
    const placeId = poiData.place_id || poiData.basic?.place_id;
    if (!placeId) {
      throw new Error('No place_id provided - cannot process POI');
    }
    
    // IMMEDIATELY exit if this is a start/end marker to prevent unnecessary processing
    if (poiData.basic?.types?.includes('route_start') || 
        poiData.basic?.types?.includes('route_end') ||
        (poiData.basic?.name && (
          poiData.basic.name.toLowerCase().includes('start point') ||
          poiData.basic.name.toLowerCase().includes('end point') ||
          poiData.basic.name.toLowerCase().includes('starting point') ||
          poiData.basic.name.toLowerCase().includes('ending point')
        ))) {
      console.log(`Skipping processing for route marker: ${poiData.basic?.name || placeId}`);
      return {
        success: true,
        message: `Skipped processing for route marker: ${poiData.basic?.name || placeId}`,
        skippedMarker: true,
        placeId: placeId
      };
    }
    
    console.log(`Processing POI with place_id: ${placeId}`);

    // Initialize Supabase client and OpenAI
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });
    
    // First, check if the POI exists in the database or create it
    // This is critical because we need the UUID (id) for saving translations
    const { data: existingPoi, error: lookupError } = await supabaseClient
      .from('Poi')
      .select('id, place_id, audio_generated_at')
      .eq('place_id', placeId)
      .maybeSingle();
    
    if (lookupError) {
      console.error(`Error looking up POI: ${lookupError.message}`);
      throw lookupError;
    }
    
    let poiUuid;
    let audioExists = false;
    
    // If POI doesn't exist, create a minimal record first
    if (!existingPoi) {
      console.log(`POI with place_id ${placeId} not found in database. Creating minimal record...`);
      
      // Extract basic info from poiData
      const name = poiData.basic?.name || 'Unknown POI';
      const formattedAddress = poiData.basic?.formatted_address || poiData.vicinity || 'Unknown location';
      const location = poiData.basic?.location || { lat: 0, lng: 0 };
      const types = poiData.basic?.types || ['point_of_interest'];
      
      const { data: newPoi, error: insertError } = await supabaseClient
        .from('Poi')
        .insert({
          place_id: placeId,
          name: name,
          formatted_address: formattedAddress,
          location: location,
          types: types,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error(`Error creating POI record: ${insertError.message}`);
        throw insertError;
      }
      
      console.log(`Created new POI record with UUID: ${newPoi.id} and place_id: ${placeId}`);
      poiUuid = newPoi.id;
    } else {
      console.log(`Found existing POI record with UUID: ${existingPoi.id}`);
      poiUuid = existingPoi.id;
      audioExists = existingPoi.audio_generated_at !== null;
      
      if (audioExists) {
        console.log(`Audio was previously generated at ${existingPoi.audio_generated_at}`);
      }
    }
    
    // Check if specific items need to be generated
    const generateOptions = poiData.generateOptions || {};
    const forceRegenerate = generateOptions.force === true;
    
    console.log(`Generation options:`, generateOptions);
    console.log(`Force regenerate: ${forceRegenerate}`);
    
    // Default: generate everything if not specified
    const shouldGenerateAudio = generateOptions.audio !== false;
    const shouldGenerateKnowledge = generateOptions.knowledge !== false;
    
    console.log(`Will generate audio: ${shouldGenerateAudio}`);
    console.log(`Will generate knowledge: ${shouldGenerateKnowledge}`);
    
    // Check for existing transcripts and audio files
    let existingTranscripts = {};
    let existingAudioPaths = {};
    
    if (audioExists && shouldGenerateAudio && !forceRegenerate) {
      console.log('Checking for existing transcripts and audio files...');
      
      // Check for existing translations
      const { data: translations, error: translationsError } = await supabaseClient
        .from('Translation')
        .select('content_type, language_code, translated_text, audio_path')
        .eq('poi_id', poiUuid)
        .eq('language_code', 'en');
      
      if (translationsError) {
        console.error(`Error fetching translations: ${translationsError.message}`);
      } else if (translations && translations.length > 0) {
        console.log(`Found ${translations.length} existing translations`);
        
        const transcripts = {};
        const audioPaths = {};
        
        translations.forEach(translation => {
          if (translation.content_type) {
            if (translation.translated_text) {
              transcripts[`${translation.content_type}_transcript`] = translation.translated_text;
            }
            if (translation.audio_path) {
              audioPaths[`${translation.content_type}_audio_path`] = translation.audio_path;
            }
          }
        });
        
        existingTranscripts = transcripts;
        existingAudioPaths = audioPaths;
        
        console.log('Existing transcripts:', Object.keys(existingTranscripts));
        console.log('Existing audio paths:', Object.keys(existingAudioPaths));
      } else {
        console.log('No existing translations found despite audio_generated_at being set');
      }
    }
    
    // Check for existing knowledge
    let knowledgeExists = false;
    let existingKnowledge = null;
    
    if (shouldGenerateKnowledge && !forceRegenerate) {
      const { data: poiKnowledge, error: knowledgeError } = await supabaseClient
        .from('poi_knowledge')
        .select('*')
        .eq('poi_id', poiUuid)
        .maybeSingle();
      
      if (knowledgeError) {
        console.error(`Error checking for existing knowledge: ${knowledgeError.message}`);
      } else if (poiKnowledge) {
        knowledgeExists = true;
        existingKnowledge = poiKnowledge;
        console.log(`Knowledge exists, last updated: ${poiKnowledge.last_updated}`);
      } else {
        console.log('No existing knowledge found');
      }
    }
    
    // Now generate content with the UUID instead of place_id
    console.log(`Using UUID ${poiUuid} for all database operations`);
    
    // Determine what needs to be generated
    const needsToGenerateAudio = shouldGenerateAudio && (forceRegenerate || !audioExists || 
      !existingTranscripts.brief_transcript || 
      !existingTranscripts.detailed_transcript || 
      !existingTranscripts.complete_transcript);
    
    const needsToGenerateKnowledge = shouldGenerateKnowledge && (forceRegenerate || !knowledgeExists);
    
    console.log(`Needs to generate audio: ${needsToGenerateAudio}`);
    console.log(`Needs to generate knowledge: ${needsToGenerateKnowledge}`);
    
    // Initialize result containers
    let audioResults = {
      brief_transcript: existingTranscripts.brief_transcript || null,
      detailed_transcript: existingTranscripts.detailed_transcript || null,
      complete_transcript: existingTranscripts.complete_transcript || null,
      brief_audio_path: existingAudioPaths.brief_audio_path || null,
      detailed_audio_path: existingAudioPaths.detailed_audio_path || null,
      complete_audio_path: existingAudioPaths.complete_audio_path || null
    };
    
    let knowledgeResult = existingKnowledge ? { 
      success: true, 
      poi_id: poiUuid,
      data: existingKnowledge 
    } : null;
    
    // Generate content only if needed
    const tasks = [];
    
    if (needsToGenerateAudio) {
      tasks.push((async () => {
        console.log('Generating audio content...');
        // Generate all content using proper prompting and OpenAI
        const coreContent = await generateCoreContent(openai, poiData);
        const secondaryContent = await generateSecondaryContent(openai, poiData, coreContent);
        const tertiaryContent = await generateTertiaryContent(openai, poiData, coreContent);
        
        // Add credits to the most complete transcript
        const credits = generateCredits(poiData);
        const tertiaryWithCredits = credits ? `${tertiaryContent}\n\n${credits}` : tertiaryContent;
        
        // Create content mappings for parallel processing
        const contentMappings = [
          { contentType: 'brief', text: coreContent },
          { contentType: 'detailed', text: secondaryContent },
          { contentType: 'complete', text: tertiaryWithCredits }
        ];
        
        // Process all content types in parallel with the UUID
        audioResults = await processAllContentTypes(contentMappings, poiUuid, placeId, 'nova', supabaseClient, openai);
        
        // Mark the Poi record as having generated audio
        const { error: updateError } = await supabaseClient
          .from('Poi')
          .update({
            audio_generated_at: new Date().toISOString()
          })
          .eq('id', poiUuid);
        
        if (updateError) {
          console.error(`Error updating POI audio generation status: ${updateError.message}`);
          console.warn(`Continuing despite Poi table update error - translations were saved successfully`);
        }
      })());
    } else {
      console.log('Skipping audio generation, using existing content');
    }
    
    if (needsToGenerateKnowledge) {
      tasks.push((async () => {
        console.log('Generating knowledge content...');
        knowledgeResult = await generateStructuredKnowledge(openai, poiData, poiUuid, supabaseClient);
      })());
    } else {
      console.log('Skipping knowledge generation, using existing content');
    }
    
    // Wait for all tasks to complete
    if (tasks.length > 0) {
      console.log(`Waiting for ${tasks.length} generation tasks to complete...`);
      await Promise.all(tasks);
    } else {
      console.log('No generation tasks needed, using all existing content');
    }
    
    return {
      success: true,
      message: `Successfully processed POI: ${poiData.basic?.name || placeId}`,
      poiId: poiUuid,
      placeId: placeId,
      audioGenerated: needsToGenerateAudio,
      knowledgeGenerated: needsToGenerateKnowledge,
      transcripts: {
        brief: audioResults.brief_transcript,
        detailed: audioResults.detailed_transcript,
        complete: audioResults.complete_transcript
      },
      audioPaths: {
        brief: audioResults.brief_audio_path,
        detailed: audioResults.detailed_audio_path,
        complete: audioResults.complete_audio_path
      },
      knowledge: knowledgeResult
    };
    
  } catch (error: any) {
    console.error('Error processing POI:', error);
    return {
      success: false,
      message: `Error processing POI: ${error.message}`,
      error: error.message
    };
  }
}

// Helper functions for content generation
async function generateCoreContent(openai, poiData) {
  const prompt = `
    Create a concise 30-60 second audio guide script about "${poiData.basic.name}".
    Focus only on the most important and interesting facts.
    Use a conversational, engaging tone as if speaking to a tourist.
    Include only essential historical context, significance, and main features.
    
    Use this information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract.substring(0, 500)}...` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide: ${poiData.wikivoyage.seeSection.substring(0, 500)}...` : ''}
    ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract.substring(0, 300)}...` : ''}
    
    The script should be brief but insightful, about 100-150 words total.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert tour guide creating audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  
  return response.choices[0].message.content || '';
}

async function generateSecondaryContent(openai, poiData, coreContent) {
  const prompt = `
    Create an additional 1-2 minute audio guide script for "${poiData.basic.name}" that builds upon this core content:
    
    "${coreContent}"
    
    This secondary content should:
    - Provide more details about architectural features, artistic significance, or historical events
    - Include interesting anecdotes or lesser-known facts
    - Explain cultural context or impact
    - Offer more detailed descriptions
    
    Use this additional information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide (See section): ${poiData.wikivoyage.seeSection}` : ''}
    ${poiData.wikivoyage?.doSection ? `Travel guide (Do section): ${poiData.wikivoyage.doSection}` : ''}
    
    The script should be about 250-300 words in a conversational style, as if speaking directly to a tourist.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert tour guide creating detailed audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  return response.choices[0].message.content || '';
}

async function generateTertiaryContent(openai, poiData, coreContent) {
  const prompt = `
    Create an extended 3+ minute audio guide script for "${poiData.basic.name}" that provides deep context beyond this previous content:
    
    "${coreContent.substring(0, 300)}..."
    
    This tertiary content should:
    - Provide in-depth historical analysis 
    - Share detailed stories and significant events connected to this place
    - Examine cultural impact and significance in depth
    - Discuss artistic or architectural details
    - Mention connections to other important sites or historical figures
    - Include interesting debates or different perspectives about this place
    
    Use all available information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
    ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract}` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide (See): ${poiData.wikivoyage.seeSection}` : ''}
    ${poiData.wikivoyage?.doSection ? `Travel guide (Do): ${poiData.wikivoyage.doSection}` : ''}
    
    The script should be 500-600 words in a conversational, engaging style.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert historian and tour guide creating in-depth audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });
  
  return response.choices[0].message.content || '';
}

function generateCredits(poiData) {
  const credits = ['Information provided by:'];
  
  if (poiData.wikipedia) {
    credits.push(`Wikipedia: "${poiData.wikipedia.title}" - ${poiData.wikipedia.url}`);
  }
  
  if (poiData.wikivoyage) {
    credits.push(`Wikivoyage: "${poiData.wikivoyage.title}" - ${poiData.wikivoyage.url}`);
  }
  
  return credits.join('\n');
}

// Helper function to split text into manageable chunks
function splitTextIntoChunks(text, maxChunkSize = 4000) {
  // Find natural breakpoints (paragraphs, sentences)
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds the limit, save current chunk and start a new one
    if ((currentChunk + paragraph).length > maxChunkSize) {
      // If current chunk is not empty, add it to chunks
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If the paragraph itself is too long, split it into sentences
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/(?<=\.|\?|\!)\s+/);
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > maxChunkSize) {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = '';
            }
            
            // If the sentence itself is too long (rare), force split it
            if (sentence.length > maxChunkSize) {
              let sentencePart = '';
              for (let i = 0; i < sentence.length; i++) {
                sentencePart += sentence[i];
                if (sentencePart.length >= maxChunkSize || i === sentence.length - 1) {
                  chunks.push(sentencePart);
                  sentencePart = '';
                }
              }
            } else {
              currentChunk = sentence;
            }
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add the last chunk if not empty
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

async function textToSpeech(text, voice = 'nova', openai) {
  try {
    console.log(`Starting TTS conversion with voice: ${voice}`);
    console.log(`Text length: ${text.length} characters`);
    
    // Check if text exceeds API limit
    if (text.length > 4000) {
      console.log(`Text exceeds 4000 character limit (${text.length}), splitting into chunks`);
      const chunks = splitTextIntoChunks(text);
      console.log(`Split into ${chunks.length} chunks`);
      
      // Process each chunk
      const buffers = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i+1}/${chunks.length} (${chunk.length} characters)`);
        
        try {
          const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voice,
            input: chunk,
          });
          
          // Convert the response to an ArrayBuffer
          const arrayBuffer = await response.arrayBuffer();
          
          // Convert ArrayBuffer to Uint8Array for Deno compatibility
          const buffer = new Uint8Array(arrayBuffer);
          console.log(`Generated audio for chunk ${i+1}, size: ${buffer.length} bytes`);
          buffers.push(buffer);
        } catch (chunkError) {
          console.error(`Error processing chunk ${i+1}:`, chunkError);
          // Continue with other chunks instead of failing completely
        }
      }
      
      // Combine buffers if multiple chunks were processed successfully
      if (buffers.length > 0) {
        // Simple concatenation of audio buffers
        const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const buffer of buffers) {
          combined.set(buffer, offset);
          offset += buffer.length;
        }
        
        console.log(`Combined ${buffers.length} audio chunks, total size: ${combined.length} bytes`);
        return combined;
      }
      
      // If we got here with no buffers, all chunks failed
      throw new Error('All text chunks failed TTS conversion');
    } else {
      // Original code for texts under the limit
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
      });
      
      // Convert the response to an ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      
      // Convert ArrayBuffer to Uint8Array for Deno compatibility
      const buffer = new Uint8Array(arrayBuffer);
      console.log(`Successfully converted text to speech, buffer size: ${buffer.length} bytes`);
      return buffer;
    }
  } catch (error) {
    console.error('OpenAI TTS API error:', error);
    throw new Error(`TTS conversion failed: ${error.message}`);
  }
}

// Replace with this properly parallel approach:
async function processAllContentTypes(contentMappings, poiId, placeId, voice, supabaseClient, openai) {
  console.log(`Processing ${contentMappings.length} content types in PARALLEL`);
  
  // Debug to check exactly what's being passed
  console.log(`Content types to process:`, contentMappings.map(c => c.contentType).join(', '));
  
  // Create promises for each content type WITHOUT awaiting them
  const processingPromises = contentMappings.map(({ contentType, text }) => {
    console.log(`Creating promise for ${contentType} content (not awaiting yet)`);
    // Return a promise that includes both the content type and the result
    return processContentType(contentType, text, poiId, placeId, voice, supabaseClient, openai)
      .then(result => {
        console.log(`Completed processing for ${contentType}`);
        return {
          contentType,
          transcript: result.transcript,
          audioPath: result.audioPath
        };
      })
      .catch(error => {
        console.error(`Error in ${contentType} processing:`, error);
        return { 
          contentType, 
          error: error.message || String(error) 
        };
      });
  });
  
  // Now await all promises to complete
  console.log(`Waiting for ALL content types to complete processing...`);
  const results = await Promise.all(processingPromises);
  console.log(`All content types have completed processing!`);
  
  // Create a properly structured result object with all processed content
  const finalData = {};
  
  // Process each result based on its content type
  for (const result of results) {
    const { contentType, transcript, audioPath, error } = result;
    
    if (error) {
      console.error(`Including error for ${contentType} in results:`, error);
      finalData[`${contentType}_error`] = error;
      continue;
    }
    
    // Add data to the appropriate fields
    switch (contentType) {
      case 'brief':
        finalData.brief_transcript = transcript;
        finalData.brief_audio_path = audioPath;
        break;
      case 'detailed':
        finalData.detailed_transcript = transcript;
        finalData.detailed_audio_path = audioPath;
        break;
      case 'complete':
        finalData.complete_transcript = transcript;
        finalData.complete_audio_path = audioPath;
        break;
      default:
        console.warn(`Unknown content type: ${contentType}`);
    }
  }
  
  return finalData;
}

// Helper functions for processing content and generating audio
async function processContentType(
  contentType,
  text,
  poiId, // UUID for database operations
  placeId, // Google Place ID for file paths
  voice,
  supabase,
  openai
) {
  try {
    // Convert text to speech
    console.log(`Starting TTS for ${contentType} content, length: ${text.length}`);
    const audioBuffer = await textToSpeech(text, voice, openai);
    console.log(`Completed TTS for ${contentType} content, buffer size: ${audioBuffer.length}`);
    
    // Store the audio file using place_id for the path
    const audioPath = await storeAudioFile(supabase, audioBuffer, placeId, contentType, voice, 'en');
    console.log(`Audio file stored for ${contentType} at ${audioPath}`);
    
    // Insert directly into the Translation table using the UUID
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('Translation')
      .upsert({
        poi_id: poiId, // UUID from Poi.id
        content_type: contentType,
        language_code: 'en',
        translated_text: text,
        audio_path: audioPath,
        created_at: now,
        updated_at: now
      }, {
        onConflict: 'poi_id,content_type,language_code'
      });
      
    if (error) {
      console.error(`Error saving translation for ${contentType}:`, error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      transcript: text,
      audioPath: audioPath
    };
  } catch (error) {
    console.error(`Error processing ${contentType} content:`, error);
    throw error;
  }
}

async function storeAudioFile(
  supabase,
  fileBuffer, 
  placeId, // Google Place ID for file paths
  contentType,
  voice,
  languageCode = 'en' // Default to English
) {
  // We want to use Google Place ID format for file paths to maintain consistency
  // placeId is likely already the Google Place ID, but we'll make sure it's properly documented
  const placeIdForPath = placeId; // Using Google Place ID for storage paths
  
  // Keep using place_id in filename format for consistency with existing files
  const fileName = `${placeIdForPath}/${languageCode}/${contentType}_audio_${Date.now()}.mp3`;
  const bucketName = 'audio-guides';
  
  console.log(`Attempting to store file: ${fileName} in bucket: ${bucketName}`);
  console.log(`File size: ${fileBuffer.length} bytes`);
  
  try {
    // Upload file to Supabase storage
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('Error uploading audio file:', error);
      throw new Error(`Storage error: ${error.message}`);
    }
    
    console.log(`Successfully uploaded file: ${fileName}`);
    console.log(`Returning storage path instead of signed URL: ${fileName}`);
    
    // Return just the storage path (no need for signed URL anymore)
    return fileName;
  } catch (error) {
    console.error(`Failed to store file ${fileName}:`, error);
    throw error;
  }
}

// NEW: Function to generate and store structured knowledge for the poi_knowledge table
async function generateStructuredKnowledge(openai, poiData, poiUuid, supabaseClient) {
  try {
    console.log(`Generating structured knowledge for POI with UUID: ${poiUuid}`);
    
    // Prepare source information
    const wikipediaSource = poiData.wikipedia?.url || null;
    const wikivoyageSource = poiData.wikivoyage?.url || null;
    
    // Generate overview - comprehensive but concise summary (250-350 words)
    const overviewPrompt = `
      Create a comprehensive yet concise overview (250-350 words) of "${poiData.basic.name}" 
      that captures its essence, significance, and key attributes.
      
      Use this information:
      ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
      ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract.substring(0, 500)}...` : ''}
      
      The overview should be thorough but efficient, covering what makes this place important,
      its main features, and why visitors should care about it. Write in a clear, informative style.
    `;
    
    // Generate historical context (200-300 words)
    const historicalPrompt = `
      Create a historical context section (200-300 words) for "${poiData.basic.name}" 
      that explains its origin, development over time, and historical significance.
      
      Use this information:
      ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
      
      Focus on key events, changes in purpose or design over time, historical figures connected to this place,
      and how its role or perception has evolved. Write in a clear, chronological style when possible.
    `;
    
    // Generate architectural details if relevant
    const architecturalPrompt = `
      Create an architectural details section (150-250 words) for "${poiData.basic.name}" 
      that describes its physical characteristics, design style, materials, and notable features.
      
      Use this information:
      ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
      ${poiData.wikivoyage?.seeSection ? `Travel guide: ${poiData.wikivoyage.seeSection}` : ''}
      
      If this is not primarily an architectural site, focus instead on its physical description,
      layout, or natural features. Skip this entirely if there are no meaningful physical characteristics to describe.
    `;
    
    // Generate cultural significance
    const culturalPrompt = `
      Create a cultural significance section (150-250 words) for "${poiData.basic.name}" 
      that explains its impact on culture, society, arts, or regional identity.
      
      Use this information:
      ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
      
      Explain how this place has influenced literature, art, film, or local traditions.
      Mention any cultural events hosted here, symbolic meaning, or representation in popular culture.
      Skip this entirely if there is no meaningful cultural significance.
    `;
    
    // Generate practical information
    const practicalPrompt = `
      Create a practical information section (100-200 words) for "${poiData.basic.name}" 
      with essential visitor information like hours, prices, accessibility, and tips.
      
      Use this information:
      ${poiData.wikivoyage?.seeSection ? `Travel guide (See): ${poiData.wikivoyage.seeSection}` : ''}
      ${poiData.wikivoyage?.doSection ? `Travel guide (Do): ${poiData.wikivoyage.doSection}` : ''}
      
      Include opening times, entry fees, best times to visit, accessibility features,
      photography policies, guided tour options, and insider tips. Be specific when possible
      but note if information might change seasonally.
    `;
    
    // Generate structured key facts as JSON
    const keyFactsPrompt = `
      Create a comprehensive JSON structure of key facts about "${poiData.basic.name}".
      
      Use this information:
      ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract.substring(0, 2000)}...` : ''}
      ${poiData.wikivoyage?.seeSection ? `Travel guide: ${poiData.wikivoyage.seeSection.substring(0, 1000)}...` : ''}
      
      The JSON should follow this structure (adapt fields as needed for this specific place):
      
      {
        "basic": {
          "name": "Full official name",
          "local_name": "Name in local language if applicable",
          "year_built": "Construction year or period",
          "designers": ["Names of architects/designers"],
          "location": "Precise address or location",
          "coordinates": {"latitude": 00.0000, "longitude": 00.0000},
          "type": "Type of place (museum, landmark, etc.)",
          "architectural_style": "If applicable"
        },
        "physical": {
          "dimensions": {"height": {"meters": 00, "feet": 00}, "area": {"sq_meters": 00}},
          "materials": ["Main construction materials"],
          "distinctive_features": ["List of notable physical features"]
        },
        "historical": {
          "original_purpose": "What it was built for",
          "construction_time": "How long it took to build",
          "notable_events": [
            {"year": 0000, "event": "Description of significant event"},
            {"year": 0000, "event": "Another significant event"}
          ],
          "renovations": [{"year": 0000, "description": "Details of major changes"}]
        },
        "visitor_info": {
          "annual_visitors": "Approximate number if known",
          "opening_hours": "General hours",
          "ticket_prices": {"adults": "00", "children": "00"},
          "best_time_to_visit": "Seasonal or time recommendations"
        }
      }
      
      Only include sections and fields that have factual information available.
      Ensure all data is accurate. Use null for unknown values, don't guess.
      Make sure the JSON is valid with proper quotes and commas.
    `;
    
    // Generate interesting trivia
    const triviaPrompt = `
      Create an array of 8-12 interesting and surprising facts or trivia points about "${poiData.basic.name}".
      
      Use this information:
      ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
      ${poiData.wikivoyage?.extract ? `Travel guide: ${poiData.wikivoyage.extract}` : ''}
      
      Each trivia item should be:
      - Fascinating and not obvious
      - Accurate and fact-based
      - 1-2 sentences in length
      - Diverse (cover different aspects)
      
      Format your response as a JSON array of strings only (without a wrapper object).
      Example format: ["Fact 1 about the place.", "Fact 2 about the place.", "Fact 3 about the place."]
    `;
    
    // Generate visitor experience
    const visitorPrompt = `
      Create a visitor experience section (150-250 words) for "${poiData.basic.name}" 
      that describes what visitors should expect, highlights to look for, and sensory experiences.
      
      Use this information:
      ${poiData.wikivoyage?.seeSection ? `Travel guide (See): ${poiData.wikivoyage.seeSection}` : ''}
      ${poiData.wikivoyage?.doSection ? `Travel guide (Do): ${poiData.wikivoyage.doSection}` : ''}
      
      Describe the typical visitor journey, what they'll see and experience, recommended routes or viewpoints,
      hidden gems to look for, and how much time to allocate. Make it vivid and experiential.
    `;
    
    // Process all prompts in parallel
    const [
      overviewResponse,
      historicalResponse,
      architecturalResponse,
      culturalResponse,
      practicalResponse,
      keyFactsResponse,
      triviaResponse,
      visitorResponse
    ] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge." },
          { role: "user", content: overviewPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge." },
          { role: "user", content: historicalPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge." },
          { role: "user", content: architecturalPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge." },
          { role: "user", content: culturalPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge." },
          { role: "user", content: practicalPrompt }
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge. Always return valid JSON." },
          { role: "user", content: keyFactsPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge. Always return valid JSON." },
          { role: "user", content: triviaPrompt }
        ],
        temperature: 0.8,
        max_tokens: 800,
        response_format: { type: "json_object" }
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert curator of travel and historical knowledge." },
          { role: "user", content: visitorPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600,
      })
    ]);
    
    // Extract content from responses
    const overview = overviewResponse.choices[0].message.content || '';
    const historical_context = historicalResponse.choices[0].message.content || '';
    const architectural_details = architecturalResponse.choices[0].message.content || '';
    const cultural_significance = culturalResponse.choices[0].message.content || '';
    const practical_info = practicalResponse.choices[0].message.content || '';
    
    // For JSON responses, parse and ensure they're valid
    let key_facts;
    try {
      // The response is already in JSON format due to response_format parameter
      const keyFactsContent = keyFactsResponse.choices[0].message.content;
      // Ensure it's properly formatted as a JSON string
      key_facts = keyFactsContent;
    } catch (error) {
      console.warn('Failed to parse key_facts JSON:', error);
      key_facts = '{}';
    }
    
    let interesting_trivia;
    try {
      const triviaContent = triviaResponse.choices[0].message.content;
      console.log('Raw trivia content:', triviaContent.substring(0, 150));
      
      // Parse the JSON to validate it's a proper array
      let triviaArray = [];
      try {
        // Parse the JSON response
        const parsedContent = JSON.parse(triviaContent);
        
        // Handle case where API returns an object with a "trivia" key instead of a direct array
        if (Array.isArray(parsedContent)) {
          console.log('Trivia is already in array format');
          triviaArray = parsedContent;
        } else if (parsedContent.trivia && Array.isArray(parsedContent.trivia)) {
          console.log('Trivia returned as an object with trivia key, extracting array');
          triviaArray = parsedContent.trivia;
        } else {
          console.warn('Trivia not in expected format:', typeof parsedContent);
          // Extract all string values from the JSON to try to salvage trivia items
          const allValues = [];
          const extractValues = (obj) => {
            if (!obj) return;
            if (typeof obj === 'string') allValues.push(obj);
            else if (Array.isArray(obj)) {
              for (const item of obj) extractValues(item);
            } else if (typeof obj === 'object') {
              for (const key in obj) extractValues(obj[key]);
            }
          };
          extractValues(parsedContent);
          
          if (allValues.length > 0) {
            console.log(`Extracted ${allValues.length} potential trivia items`);
            triviaArray = allValues;
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse trivia JSON:', parseError);
        
        // Fallback: Try to extract array using regex if JSON parsing fails
        // Using a simplified regex that works in older JS versions
        const arrayMatch = triviaContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            const potentialArray = JSON.parse(arrayMatch[0]);
            if (Array.isArray(potentialArray)) {
              triviaArray = potentialArray;
              console.log(`Extracted ${triviaArray.length} trivia items via regex`);
            }
          } catch (e) {
            console.warn('Could not parse extracted array:', e);
          }
        }
      }
      
      // Convert JavaScript array to PostgreSQL text[] format
      if (triviaArray.length > 0) {
        console.log(`Converting ${triviaArray.length} trivia items to PostgreSQL array format`);
        // Format as PostgreSQL array literal: each element is quoted and escaped
        const pgArray = triviaArray.map(item => {
          if (typeof item !== 'string') {
            return String(item);
          }
          // Escape single quotes and backslashes for PostgreSQL
          return item.replace(/\\/g, '\\\\').replace(/'/g, "''");
        });
        
        // Final PostgreSQL array format is {item1,item2,item3}
        interesting_trivia = `{${pgArray.map(item => `"${item}"`).join(',')}}`;
        console.log(`Formatted as PostgreSQL array: ${interesting_trivia.substring(0, 50)}...`);
      } else {
        console.warn('No valid trivia items found, using empty array');
        interesting_trivia = '{}'; // Empty PostgreSQL array
      }
    } catch (error) {
      console.warn('Failed to process interesting_trivia:', error);
      interesting_trivia = '{}'; // Empty PostgreSQL array
    }
    
    const visitor_experience = visitorResponse.choices[0].message.content || '';
    
    // Log parsed values for debugging
    console.log(`Saving key_facts (truncated): ${key_facts.substring(0, 100)}...`);
    console.log(`Saving interesting_trivia (truncated): ${interesting_trivia.substring(0, 100)}...`);
    
    // Save to poi_knowledge table
    const { data: savedKnowledge, error: knowledgeError } = await supabaseClient
      .from('poi_knowledge')
      .upsert({
        poi_id: poiUuid,
        overview,
        historical_context,
        architectural_details,
        cultural_significance,
        practical_info,
        key_facts,
        interesting_trivia,
        visitor_experience,
        source_wikipedia: wikipediaSource,
        source_wikivoyage: wikivoyageSource,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'poi_id'
      })
      .select();
    
    if (knowledgeError) {
      console.error('Error saving structured knowledge:', knowledgeError);
      throw knowledgeError;
    }
    
    console.log(`Successfully saved structured knowledge for POI with UUID: ${poiUuid}`);
    return {
      success: true,
      poi_id: poiUuid
    };
    
  } catch (error) {
    console.error('Error generating structured knowledge:', error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
} 