import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import OpenAI from 'https://esm.sh/openai@4.16.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Get request data
    const { poiData } = await req.json()
    
    if (!poiData || !poiData.basic || !poiData.basic.name) {
      return new Response(
        JSON.stringify({ error: 'Invalid POI data. Must include basic information.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Initialize Supabase client (for database queries and updates)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Check if this POI already has audio content
    const poiId = poiData.id || poiData.place_id;
    console.log(`Checking if POI ${poiData.basic.name} (${poiId}) already has content...`);
    
    const { data: existingAudio, error: queryError } = await supabaseClient
      .from('Poi')
      .select('brief_audio_url, detailed_audio_url, complete_audio_url, brief_transcript, detailed_transcript, complete_transcript')
      .eq('id', poiId)
      .single();
    
    // If we have all the content and audio URLs, return them without regenerating
    if (!queryError && existingAudio && 
        existingAudio.brief_audio_url && 
        existingAudio.detailed_audio_url && 
        existingAudio.complete_audio_url) {
      console.log(`POI ${poiData.basic.name} already has audio - returning existing data`);
      return new Response(
        JSON.stringify({
          success: true,
          poiId: poiId,
          name: poiData.basic.name,
          audioFiles: {
            coreAudioUrl: existingAudio.brief_audio_url,
            secondaryAudioUrl: existingAudio.detailed_audio_url,
            tertiaryAudioUrl: existingAudio.complete_audio_url
          },
          content: {
            core: existingAudio.brief_transcript,
            secondary: existingAudio.detailed_transcript,
            tertiary: existingAudio.complete_transcript
          },
          existingContent: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    if (queryError) {
      console.log(`Could not find existing POI data, will generate new content. Error: ${queryError.message}`);
    } else {
      console.log(`POI ${poiData.basic.name} needs new or updated content.`);
    }
    
    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })
    
    // 1. Generate all content in parallel (where possible)
    console.log(`Generating content for ${poiData.basic.name}...`);
    
    // Generate core content
    const coreContent = await generateCoreContent(openai, poiData);
    
    // Generate secondary and tertiary content in parallel
    const [secondaryContent, tertiaryContent] = await Promise.all([
      generateSecondaryContent(openai, poiData, coreContent),
      generateTertiaryContent(openai, poiData, coreContent)
    ]);
    
    // Generate credits
    const credits = generateCredits(poiData);
    
    const content = {
      core: coreContent,
      secondary: secondaryContent,
      tertiary: tertiaryContent,
      credits: credits
    };
    
    // 2. Generate speech in parallel
    console.log(`Converting to speech for ${poiData.basic.name}...`);
    
    const voice = 'nova'; // Default voice
    const contentMappings = [
      { contentType: 'brief', text: content.core },
      { contentType: 'detailed', text: content.secondary },
      { contentType: 'complete', text: content.tertiary }
    ];
    
    // Replace with this more resilient approach:
    const audioUrls = await processAllContentTypes(contentMappings, poiId, voice, supabaseClient, openai);
    
    // 3. Save results to database
    console.log(`Saving results for ${poiData.basic.name}...`);
    
    await saveToDatabase(supabaseClient, poiData.id || poiData.place_id, {
      name: poiData.basic.name,
      briefTranscript: content.core,
      detailedTranscript: content.secondary,
      completeTranscript: content.tertiary,
      briefAudioUrl: audioUrls.coreAudioUrl,
      detailedAudioUrl: audioUrls.secondaryAudioUrl,
      completeAudioUrl: audioUrls.tertiaryAudioUrl,
      formatted_address: poiData?.basic?.formatted_address || poiData?.vicinity || 'Unknown location',
      location: poiData?.basic?.location || { lat: 0, lng: 0 },
      types: poiData?.basic?.types || ["point_of_interest"],
      last_updated_at: new Date().toISOString()
    });
    
    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        poiId: poiData.id || poiData.place_id,
        name: poiData.basic.name,
        audioFiles: {
          coreAudioUrl: audioUrls.coreAudioUrl,
          secondaryAudioUrl: audioUrls.secondaryAudioUrl,
          tertiaryAudioUrl: audioUrls.tertiaryAudioUrl
        },
        content: {
          core: content.core,
          secondary: content.secondary,
          tertiary: content.tertiary,
          credits: content.credits
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error processing POI:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        details: error.stack || 'No stack trace available'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

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

// Update the main function to process content types independently rather than with Promise.all
// In the main serve function, replace the Promise.all content processing with:

/*
    // Original code with Promise.all:
    const audioResults = await Promise.all(
      contentMappings.map(({ contentType, text }) => 
        processContentType(contentType, text, poiData.id || poiData.place_id, voice, supabaseClient, openai)
      )
    );
    
    // Collect audio URLs
    const audioUrls = {
      coreAudioUrl: audioResults[0].audioUrl,
      secondaryAudioUrl: audioResults[1].audioUrl,
      tertiaryAudioUrl: audioResults[2].audioUrl
    };
*/

// Replace with this more resilient approach:
async function processAllContentTypes(contentMappings, poiId, voice, supabaseClient, openai) {
  console.log(`Processing ${contentMappings.length} content types independently`);
  
  const audioUrls = {
    coreAudioUrl: '',
    secondaryAudioUrl: '',
    tertiaryAudioUrl: ''
  };
  
  // Process each content type independently
  for (const { contentType, text } of contentMappings) {
    try {
      console.log(`Starting processing of ${contentType} content (${text.length} characters)`);
      const result = await processContentType(contentType, text, poiId, voice, supabaseClient, openai);
      
      // Map content type to the appropriate audio URL property
      if (contentType === 'brief') {
        audioUrls.coreAudioUrl = result.audioUrl;
      } else if (contentType === 'detailed') {
        audioUrls.secondaryAudioUrl = result.audioUrl;
      } else if (contentType === 'complete') {
        audioUrls.tertiaryAudioUrl = result.audioUrl;
      }
      
      console.log(`Successfully processed ${contentType} content`);
    } catch (error) {
      console.error(`Error processing ${contentType} content:`, error);
      // Continue with other content types instead of failing everything
    }
  }
  
  return audioUrls;
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
    console.log(`Attempting to save data for POI ID: ${poiId}`);

    // First, let's check if the POI table exists and create it if it doesn't
    try {
      console.log('Checking if POI table exists...');
      
      // Try to query the table to see if it exists
      const { error: tableError } = await supabaseClient
        .from('Poi')
        .select('id')
        .limit(1);
      
      // If we get a specific error about the table not existing, create it
      if (tableError && tableError.code === '42P01') {
        console.log('Table does not exist. Creating POI table...');
        
        // Create the table using SQL
        const { error: createError } = await supabaseClient.rpc(
          'execute_sql',
          {
            sql: `
              CREATE TABLE IF NOT EXISTS public."Poi" (
                id TEXT PRIMARY KEY,
                name TEXT,
                brief_transcript TEXT,
                detailed_transcript TEXT,
                complete_transcript TEXT,
                brief_audio_url TEXT,
                detailed_audio_url TEXT,
                complete_audio_url TEXT,
                audio_generated_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
              );
            `
          }
        );
        
        if (createError) {
          // If we can't create using RPC, we'll try a different approach
          console.error('Error creating table using RPC:', createError);
          
          // Let's try inserting directly with fallback handling
          console.log('Using direct insert with fallback approach');
        } else {
          console.log('Successfully created POI table');
        }
      }
    } catch (tableLookupError) {
      console.error('Error checking table existence:', tableLookupError);
    }
    
    // Now try to insert the data, regardless of whether we created the table or not
    // First try with 'Poi' (lowercase)
    try {
      console.log('Attempting to save to "Poi" table...');
      const updateData = {
        name: data.name,
        brief_transcript: data.briefTranscript,
        detailed_transcript: data.detailedTranscript, 
        complete_transcript: data.completeTranscript,
        brief_audio_url: data.briefAudioUrl,
        detailed_audio_url: data.detailedAudioUrl,
        complete_audio_url: data.completeAudioUrl,
        audio_generated_at: new Date().toISOString()
      };
      
      console.log('Data being saved:', JSON.stringify(updateData, null, 2));
      
      // First try to check if the record exists by trying to update
      const { data: updateResult, error: updateError } = await supabaseClient
        .from('Poi')
        .upsert({
          id: poiId,
          place_id: poiId,
          formatted_address: data.formatted_address || 'Unknown location',
          name: data.name || 'Unnamed location',
          location: data.location || { lat: 0, lng: 0 }, // Default to 0,0 if missing
          types: data.types || ["point_of_interest"], // Default to generic type
          last_updated_at: new Date().toISOString(), // Current timestamp
          ...updateData
        })
        .select();
      
      if (updateError) {
        console.error('Error updating "Poi" table:', updateError);
        throw new Error(`Database error: ${updateError.message || 'Failed to save POI audio data'}`);
      }
      
      console.log(`Successfully saved audio data for POI ${poiId} to "Poi" table`);
      return updateResult;
    } catch (saveError) {
      console.error('Error in main save operation:', saveError);
      throw saveError;
    }
  } catch (error) {
    console.error('Error in saveToDatabase:', error);
    throw new Error(`Failed to save POI data to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 