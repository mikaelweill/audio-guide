import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Voice options
export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const { content, poiId, voice = 'nova' } = await request.json();
    
    if (!content || !poiId) {
      return NextResponse.json(
        { error: 'Missing required parameters: content and poiId' },
        { status: 400 }
      );
    }
    
    if (!content.core || !content.secondary || !content.tertiary) {
      return NextResponse.json(
        { error: 'Content must include core, secondary, and tertiary sections' },
        { status: 400 }
      );
    }
    
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Initialize Supabase with service role key
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Supabase URL is not configured' },
        { status: 500 }
      );
    }
    
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    try {
      // Log buckets to confirm we can access them
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      
      if (listError) {
        console.error('Error listing buckets:', listError);
        return NextResponse.json(
          { error: 'Failed to list storage buckets', details: listError.message },
          { status: 500 }
        );
      }
      
      console.log('Available buckets:', buckets.map(b => b.name).join(', '));
      
      // Process all content types in parallel
      // This will generate and store all audio files concurrently
      const results = await Promise.allSettled([
        processContentType('brief', content.core, poiId, voice, supabaseAdmin, openai),
        processContentType('detailed', content.secondary, poiId, voice, supabaseAdmin, openai),
        processContentType('complete', content.tertiary, poiId, voice, supabaseAdmin, openai)
      ]);
      
      // Collect results
      const audioUrls: Record<string, string> = {};
      let hasErrors = false;
      let errorMessages: string[] = [];
      
      results.forEach((result, index) => {
        const contentTypes = ['brief', 'detailed', 'complete'];
        const contentType = contentTypes[index];
        
        if (result.status === 'fulfilled') {
          audioUrls[`${contentType}AudioUrl`] = result.value.audioUrl;
          console.log(`Successfully processed ${contentType} content for POI ${poiId}`);
        } else {
          hasErrors = true;
          errorMessages.push(`Failed to process ${contentType} content: ${result.reason.message}`);
          console.error(`Error processing ${contentType} content:`, result.reason);
        }
      });
      
      // Update the database with audio generation timestamp
      await prisma.poi.update({
        where: { id: poiId },
        data: {
          brief_audio_url: audioUrls.briefAudioUrl || null,
          detailed_audio_url: audioUrls.detailedAudioUrl || null,
          complete_audio_url: audioUrls.completeAudioUrl || null,
          brief_transcript: content.core || null,
          detailed_transcript: content.secondary || null,
          complete_transcript: content.tertiary || null,
          audio_generated_at: new Date()
        }
      });
      
      // Return the audio URLs even if some failed (partial success)
      return NextResponse.json({
        audioFiles: {
          coreAudioUrl: audioUrls.briefAudioUrl,
          secondaryAudioUrl: audioUrls.detailedAudioUrl,
          tertiaryAudioUrl: audioUrls.completeAudioUrl
        },
        hasErrors,
        errorMessages
      });
      
    } catch (error: any) {
      console.error('Error in TTS API:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      
      return NextResponse.json(
        { 
          error: 'Failed to generate speech',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in TTS API:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      { 
        error: 'Failed to generate speech',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    // Disconnect Prisma client to avoid connection leaks
    await prisma.$disconnect();
  }
}

// Helper function to process a single content type
async function processContentType(
  contentType: 'brief' | 'detailed' | 'complete',
  text: string,
  poiId: string,
  voice: VoiceOption,
  supabase: any,
  openai: OpenAI
): Promise<{ audioUrl: string }> {
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

// Helper functions for TTS and storage
async function textToSpeech(text: string, voice: VoiceOption = 'nova', openai: OpenAI): Promise<Buffer> {
  try {
    console.log(`Starting TTS conversion with voice: ${voice}`);
    console.log(`Text length: ${text.length} characters`);
    
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
    });
    
    // Convert the response to a buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`Successfully converted text to speech, buffer size: ${buffer.length} bytes`);
    return buffer;
  } catch (error: any) {
    console.error('OpenAI TTS API error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw new Error(`TTS conversion failed: ${error.message}`);
  }
}

async function storeAudioFile(
  supabase: any,
  fileBuffer: Buffer, 
  poiId: string, 
  contentType: 'brief' | 'detailed' | 'complete',
  voice: VoiceOption
): Promise<string> {
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
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading audio file:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Storage error: ${error.message}. Code: ${error.statusCode || 'unknown'}`);
    }
    
    console.log(`Successfully uploaded file: ${fileName}`);
    
    // Get the public URL
    const { data: urlData } = supabase
      .storage
      .from(bucketName)
      .getPublicUrl(fileName);
    
    console.log(`Generated public URL:`, urlData.publicUrl);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error(`Failed to store file ${fileName}:`, error);
    throw error;
  }
} 