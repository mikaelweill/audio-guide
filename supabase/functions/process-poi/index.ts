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
  console.log(`Processing POI: ${poiData.basic?.name || poiData.id || 'unknown'}`);
  
  // Validate POI data
  if (!poiData.id && !poiData.place_id) {
    throw new Error("POI is missing required ID field");
  }
  
  // Ensure we have both ID formats
  const poiId = poiData.id || poiData.place_id;
  const placeId = poiData.place_id || poiData.id;
  
  console.log(`Using ID: ${poiId} and place_id: ${placeId} for database operations`);
  
  // Initialize Supabase client and OpenAI
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY'),
  });
  
  // Generate all content using proper prompting and OpenAI
  console.log(`Generating content for ${poiData.basic?.name}...`);
  
  // Generate core content using Wikipedia/Wikivoyage data
  const coreContent = await generateCoreContent(openai, poiData);
  
  // Generate secondary and tertiary content in parallel
  const [secondaryContent, tertiaryContent] = await Promise.all([
    generateSecondaryContent(openai, poiData, coreContent),
    generateTertiaryContent(openai, poiData, coreContent)
  ]);
  
  // Generate credits
  const credits = generateCredits(poiData);
  
  // Prepare content mappings for audio generation
  const contentMappings = [
    { contentType: 'brief', text: coreContent },
    { contentType: 'detailed', text: secondaryContent },
    { contentType: 'complete', text: tertiaryContent }
  ];
  
  // Process all content types in parallel to get audio URLs
  const audioResults = await processAllContentTypes(contentMappings, poiId, 'nova', supabaseClient, openai);
  
  // Make sure our result keys match the database column names
  const mappedAudioUrls = {
    brief_audio_url: audioResults.coreAudioUrl,
    detailed_audio_url: audioResults.secondaryAudioUrl, 
    complete_audio_url: audioResults.tertiaryAudioUrl
  };
  
  // Save results to database with the UUID ID using snake_case column names
  const dbResult = await saveToDatabase(supabaseClient, poiId, {
    name: poiData.basic?.name,
    place_id: placeId, // Explicitly set place_id
    brief_transcript: coreContent,
    detailed_transcript: secondaryContent,
    complete_transcript: tertiaryContent,
    brief_audio_url: audioResults.coreAudioUrl,
    detailed_audio_url: audioResults.secondaryAudioUrl,
    complete_audio_url: audioResults.tertiaryAudioUrl,
    formatted_address: poiData?.basic?.formatted_address || poiData?.vicinity || 'Unknown location',
    location: poiData?.basic?.location || { lat: 0, lng: 0 },
    types: poiData?.basic?.types || ["point_of_interest"],
    last_updated_at: new Date().toISOString()
  });
  
  return {
    poiId,
    placeId,
    audioUrls: mappedAudioUrls,
    transcripts: {
      brief: coreContent,
      detailed: secondaryContent,
      complete: tertiaryContent
    },
    dbResult
  };
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
async function processAllContentTypes(contentMappings, poiId, voice, supabaseClient, openai) {
  console.log(`Processing ${contentMappings.length} content types in PARALLEL`);
  
  // Debug to check exactly what's being passed
  console.log(`Content types to process:`, contentMappings.map(c => c.contentType).join(', '));
  
  // Create promises for each content type WITHOUT awaiting them
  const processingPromises = contentMappings.map(({ contentType, text }) => {
    console.log(`Creating promise for ${contentType} content (not awaiting yet)`);
    // Return a promise that includes both the content type and the result
    return processContentType(contentType, text, poiId, voice, supabaseClient, openai)
      .then(result => ({
        type: contentType,
        audioUrl: result.audioUrl
      }))
      .catch(error => {
        console.error(`Error processing ${contentType} content:`, error);
        return {
          type: contentType,
          error: error.message || 'Unknown error'
        };
      });
  });
  
  // Wait for ALL content types to complete in parallel
  console.log(`Waiting for all ${processingPromises.length} promises to resolve...`);
  const results = await Promise.all(processingPromises);
  
  console.log(`All ${results.length} promises have resolved`);
  
  // Process results and determine what succeeded/failed
  const successfulResults = results.filter(r => r.audioUrl);
  const failedResults = results.filter(r => r.error);
  
  console.log(`${successfulResults.length} succeeded, ${failedResults.length} failed`);
  
  if (failedResults.length > 0) {
    console.warn('Failed content types:', failedResults.map(r => r.type).join(', '));
  }
  
  // Map results to a more convenient structure for caller
  // Update to use snake_case for returned property names to match database schema
  const resultMap = {
    coreAudioUrl: results.find(r => r.type === 'brief')?.audioUrl || null,
    secondaryAudioUrl: results.find(r => r.type === 'detailed')?.audioUrl || null,
    tertiaryAudioUrl: results.find(r => r.type === 'complete')?.audioUrl || null
  };
  
  // Make sure all promises resolved successfully
  if (Object.values(resultMap).some(v => v === null)) {
    const missingTypes = [];
    if (!resultMap.coreAudioUrl) missingTypes.push('brief');
    if (!resultMap.secondaryAudioUrl) missingTypes.push('detailed');
    if (!resultMap.tertiaryAudioUrl) missingTypes.push('complete');
    
    console.warn(`Warning: Some audio types failed to process: ${missingTypes.join(', ')}`);
  } else {
    console.log(`All 3 promises have resolved`);
  }
  
  return resultMap;
}

// Helper functions for processing content and generating audio
async function processContentType(
  contentType,
  text,
  poiId,
  voice,
  supabase,
  openai
) {
  try {
    // Convert text to speech
    const audioBuffer = await textToSpeech(text, voice, openai);
    
    // Store the audio file
    const audioUrl = await storeAudioFile(supabase, audioBuffer, poiId, contentType, voice);
    
    return { audioUrl };
  } catch (error) {
    console.error(`Error processing ${contentType} content:`, error);
    throw error;
  }
}

async function storeAudioFile(
  supabase,
  fileBuffer, 
  poiId, 
  contentType,
  voice
) {
  // Changed filename format to remove voice name and use more descriptive size terms
  const fileName = `${poiId}/${contentType}_audio_${Date.now()}.mp3`;
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
    
    // Create a signed URL with a 24-hour expiry
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(bucketName)
      .createSignedUrl(fileName, 60 * 60 * 24); // 24 hours in seconds
    
    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      
      // Fallback to public URL if signed URL fails
      const { data: urlData } = supabase
        .storage
        .from(bucketName)
        .getPublicUrl(fileName);
      
      console.log(`Fallback to public URL:`, urlData.publicUrl);
      return urlData.publicUrl;
    }
    
    console.log(`Generated signed URL (expires in 24h):`, signedUrlData.signedUrl);
    return signedUrlData.signedUrl;
  } catch (error) {
    console.error(`Failed to store file ${fileName}:`, error);
    throw error;
  }
}

async function saveToDatabase(supabaseClient, poiId, data) {
  try {
    console.log(`Adding audio data for POI ID: ${poiId}`);
    
    // Check which ID format we have - prefer the UUID format that frontend expects
    let idToUse = poiId;
    
    // If we have a place_id format (starts with Ch) but not a UUID format, log a warning
    const isGooglePlaceId = poiId.startsWith('Ch') && !poiId.includes('-');
    if (isGooglePlaceId) {
      console.warn(`Warning: Using Google Place ID (${poiId}) for lookup - it should match place_id in database`);
    }
    
    // Just prepare the audio data fields to update
    const audioOnlyFields = {
      brief_transcript: data.brief_transcript,
      detailed_transcript: data.detailed_transcript,
      complete_transcript: data.complete_transcript,
      brief_audio_url: data.brief_audio_url,
      detailed_audio_url: data.detailed_audio_url,
      complete_audio_url: data.complete_audio_url,
      audio_generated_at: new Date().toISOString()
    };
    
    // Log the fields being updated
    console.log('Updating database with audio fields:', audioOnlyFields);
    
    // Simple update operation - only update the audio-related fields
    // Look up the row using place_id instead of id
    const { data: updateResult, error: updateError } = await supabaseClient
      .from('Poi')
      .update(audioOnlyFields)
      .eq('place_id', idToUse);
    
    if (updateError) {
      console.error(`Error updating POI audio data: ${updateError.message}`);
      throw updateError;
    }
    
    console.log(`Successfully updated audio data for POI with place_id ${idToUse}`);
    return { success: true, id: idToUse };
    
  } catch (error: any) {
    console.error(`Error in saveToDatabase: ${error.message}`);
    throw error;
  }
} 