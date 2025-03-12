/**
 * Translate Content - Supabase Edge Function
 * 
 * Translates POI content from English to the user's preferred language
 * and generates audio in that language using OpenAI.
 * 
 * Deploy this function with:
 * supabase functions deploy translate-content --project-ref YOUR_PROJECT_REF
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import OpenAI from 'https://esm.sh/openai@4.16.1'

// Custom decoder for working with OpenAI response in Deno
const decode = async (readable: ReadableStream): Promise<Uint8Array> => {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  // Calculate total length
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  
  // Combine chunks
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

// Voice mappings for different languages
const languageVoiceMap: Record<string, string> = {
  'en': 'nova',      // English - Nova
  'es': 'alloy',     // Spanish - Alloy
  'fr': 'echo',      // French - Echo
  'de': 'onyx',      // German - Onyx
  'ja': 'shimmer'    // Japanese - Shimmer
};

// Main handler for the function
serve(async (req: Request) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Parse request body
    const { poiId, targetLanguage, sourceLanguageCode = 'en' } = await req.json();
    
    if (!poiId || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: poiId and targetLanguage' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log(`Translating content for POI: ${poiId} from ${sourceLanguageCode} to ${targetLanguage}`);
    
    // Initialize clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    // Define the required content types
    const requiredContentTypes = ['brief', 'detailed', 'complete'];
    
    // Check if any translations already exist in the target language
    const { data: existingTranslations, error: existingError } = await supabaseClient
      .from('Translation')
      .select('content_type, audio_path')
      .eq('poi_id', poiId)
      .eq('language_code', targetLanguage);
    
    if (existingError) {
      console.error('Error checking existing translations:', existingError);
    }
    
    // Determine which content types are missing or incomplete
    const completedTypes = new Set();
    
    if (existingTranslations && existingTranslations.length > 0) {
      console.log(`Found ${existingTranslations.length} existing translations in ${targetLanguage}`);
      
      // Add content types that have both text and audio to the completed set
      existingTranslations.forEach(item => {
        if (item.content_type && item.audio_path) {
          completedTypes.add(item.content_type);
          console.log(`Content type ${item.content_type} already has complete translation with audio`);
        }
      });
    }
    
    // Determine which content types need to be translated
    const contentTypesToTranslate = requiredContentTypes.filter(type => !completedTypes.has(type));
    
    if (contentTypesToTranslate.length === 0) {
      console.log(`All required content types already have translations in ${targetLanguage}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `All content types already exist in ${targetLanguage}`,
          skipped: true,
          completedTypes: Array.from(completedTypes)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Need to translate the following content types: ${contentTypesToTranslate.join(', ')}`);

    // 1. Fetch source language content (English) for the needed content types
    const { data: sourceContent, error: sourceError } = await supabaseClient
      .from('Translation')
      .select('content_type, translated_text')
      .eq('poi_id', poiId)
      .eq('language_code', sourceLanguageCode)
      .in('content_type', contentTypesToTranslate);
    
    if (sourceError || !sourceContent || sourceContent.length === 0) {
      return new Response(
        JSON.stringify({ error: `No ${sourceLanguageCode} content found to translate from for the missing types`, details: sourceError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    console.log(`Found ${sourceContent.length} content items to translate`);
    
    // 2. Process each content type (brief, detailed, complete) in parallel
    const contentMappings = sourceContent.map(item => ({
      contentType: item.content_type,
      text: item.translated_text
    }));
    
    // Select the appropriate voice for the target language
    const voice = languageVoiceMap[targetLanguage] || 'nova';
    
    // 3. Process all content in parallel
    const results = await processAllContentTypes(contentMappings, poiId, targetLanguage, voice, supabaseClient, openai);
    
    // 4. Return the results
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully translated missing content to ${targetLanguage}`,
        results,
        translated: contentTypesToTranslate,
        alreadyCompleted: Array.from(completedTypes)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Translation function error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ error: 'Translation function error', details: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Process all content types in parallel
async function processAllContentTypes(contentMappings: any[], poiId: string, targetLanguage: string, voice: string, supabaseClient: any, openai: any) {
  console.log(`Processing ${contentMappings.length} content types for translation to ${targetLanguage}`);
  
  // Process each content type in parallel
  const processingPromises = contentMappings.map(({ contentType, text }) => {
    console.log(`Creating translation process for ${contentType} content`);
    return processContentTranslation(contentType, text, poiId, targetLanguage, voice, supabaseClient, openai)
      .then(result => ({ contentType, result }))
      .catch(error => ({ contentType, error: error instanceof Error ? error.message : String(error) }));
  });
  
  // Wait for all content to be processed
  const results = await Promise.all(processingPromises);
  
  // Format results
  return results.reduce((acc, { contentType, result, error }) => {
    acc[contentType] = error ? { error } : result;
    return acc;
  }, {} as Record<string, any>);
}

// Process a single content type
async function processContentTranslation(
  contentType: string,
  sourceText: string,
  poiId: string,
  targetLanguage: string,
  voice: string,
  supabase: any,
  openai: any
) {
  try {
    console.log(`Translating ${contentType} content to ${targetLanguage}`);
    
    // 1. Translate the text using OpenAI
    const translatedText = await translateText(sourceText, targetLanguage, openai);
    console.log(`Successfully translated ${contentType} content (${translatedText.length} chars)`);
    
    // 2. Convert the translated text to speech
    const audioData = await textToSpeech(translatedText, voice, openai);
    console.log(`Generated speech for ${contentType} content in ${targetLanguage}`);
    
    // 3. Store the audio file
    const audioPath = await storeAudioFile(supabase, audioData, poiId, contentType, targetLanguage, voice);
    console.log(`Stored audio file for ${contentType} content: ${audioPath}`);
    
    // 4. Create a new translation record
    const { data, error } = await supabase
      .from('Translation')
      .upsert({
        poi_id: poiId,
        content_type: contentType,
        language_code: targetLanguage,
        translated_text: translatedText,
        audio_path: audioPath,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'poi_id,content_type,language_code'
      });
      
    if (error) {
      console.error(`Error saving translation for ${contentType}:`, error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      translated_text: translatedText,
      audio_path: audioPath
    };
  } catch (error: unknown) {
    console.error(`Error processing ${contentType} content:`, error);
    throw error;
  }
}

// Translate text using OpenAI
async function translateText(text: string, targetLanguage: string, openai: any): Promise<string> {
  // Language labels for prompting
  const languageLabels: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese'
  };
  
  const languageName = languageLabels[targetLanguage] || targetLanguage;
  
  try {
    console.log(`Starting translation to ${languageName}`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in ${languageName}. 
Translate the following tour guide content from English to ${languageName}.
Maintain the informative and engaging tone of the original.
Adapt cultural references when appropriate to resonate with ${languageName} speakers.
Preserve all formatting, paragraph breaks, and punctuation structure.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });
    
    const translatedText = response.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      throw new Error('Translation API returned empty response');
    }
    
    return translatedText;
  } catch (error: unknown) {
    console.error('Translation error:', error);
    throw new Error(`Translation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Text to speech function (adapted to match process-poi implementation)
async function textToSpeech(text: string, voice = 'nova', openai: any): Promise<Uint8Array> {
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
  } catch (error: unknown) {
    console.error('OpenAI TTS API error:', error);
    throw new Error(`TTS conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to split text into manageable chunks
function splitTextIntoChunks(text: string, maxChunkSize = 4000): string[] {
  // Find natural breakpoints (paragraphs, sentences)
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit, start a new chunk
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      // If the current chunk is not empty, push it
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If the paragraph itself is too long, split it further by sentences
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 1 > maxChunkSize) {
            chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          } else {
            sentenceChunk = sentenceChunk.length === 0 ? sentence : `${sentenceChunk} ${sentence}`;
          }
        }
        
        if (sentenceChunk.length > 0) {
          currentChunk = sentenceChunk;
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      // Add this paragraph to the current chunk
      currentChunk = currentChunk.length === 0 ? paragraph : `${currentChunk}\n\n${paragraph}`;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Store audio file function (adapted for Deno)
async function storeAudioFile(
  supabase: any,
  fileData: Uint8Array, 
  poiId: string, 
  contentType: string,
  languageCode: string,
  voice: string
): Promise<string> {
  const fileName = `${poiId}/${languageCode}/${contentType}_audio_${Date.now()}.mp3`;
  const bucketName = 'audio-guides';
  
  console.log(`Storing file: ${fileName} in bucket: ${bucketName}`);
  
  try {
    // Upload file to Supabase storage
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .upload(fileName, fileData, {
        contentType: 'audio/mpeg',
        upsert: true,
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('Error uploading audio file:', error);
      throw new Error(`Storage error: ${error.message}`);
    }
    
    console.log(`Successfully uploaded file: ${fileName}`);
    return fileName;
    
  } catch (error: unknown) {
    console.error('Error in file storage:', error);
    throw new Error(`Storage operation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 