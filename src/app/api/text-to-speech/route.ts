import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Initialize OpenAI client (server-side only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Voice options
export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// =========================================================================
// WARNING: TESTING CONFIGURATION - REMOVE IN PRODUCTION
// This API currently bypasses Supabase storage and returns mock URLs.
// This is only for testing the API flow without requiring Supabase storage.
// For production, you need to:
// 1. Set bypassStorage = false (or remove it completely) in the POST handler
// 2. Configure your Supabase project with proper storage settings
// =========================================================================

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    // TEMPORARILY DISABLED FOR TESTING
    // In production, you should re-enable this authentication check
    /*
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    */
    
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
    
    // Remove the testing bypass - use real storage
    // const bypassStorage = true;
    // if (bypassStorage) {
    //   console.log('TESTING: Bypassing storage for TTS audio');
    //   // Return mock URLs for testing
    //   return NextResponse.json({
    //     audioFiles: {
    //       coreAudioUrl: `https://example.com/mock-audio/core_${Date.now()}.mp3`,
    //       secondaryAudioUrl: `https://example.com/mock-audio/secondary_${Date.now()}.mp3`,
    //       tertiaryAudioUrl: `https://example.com/mock-audio/tertiary_${Date.now()}.mp3`
    //     }
    //   });
    // }
    
    try {
      // Initialize storage bucket (if needed)
      await initializeAudioStorage(supabase);
      
      // Convert all content to speech and store
      const audioFiles = await generateAndStoreAudio(content, poiId, voice, supabase);
      
      return NextResponse.json({ audioFiles });
    } catch (storageError: any) {
      console.error('Supabase storage error:', storageError);
      
      // Return a more specific error based on the type
      if (storageError.message?.includes('Permission denied')) {
        return NextResponse.json(
          { 
            error: 'Storage permission denied. Make sure your Supabase storage is properly configured and publicly accessible.',
            details: storageError.message
          },
          { status: 403 }
        );
      } else if (storageError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Storage bucket not found. There was an error creating the audio-guides bucket.',
            details: storageError.message
          },
          { status: 404 }
        );
      } else {
        return NextResponse.json(
          { 
            error: 'Supabase storage error', 
            details: storageError.message || 'Unknown storage error'
          },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error in TTS API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate speech',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions for TTS and storage
async function textToSpeech(text: string, voice: VoiceOption = 'nova'): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: text,
  });
  
  // Convert the response to a buffer
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

async function storeAudioFile(
  supabase: any,
  fileBuffer: Buffer, 
  poiId: string, 
  contentType: 'core' | 'secondary' | 'tertiary',
  voice: VoiceOption
): Promise<string> {
  const fileName = `${poiId}/${contentType}_${voice}_${Date.now()}.mp3`;
  const bucketName = 'audio-guides';
  
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
    throw error;
  }
  
  // Get the public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from(bucketName)
    .getPublicUrl(fileName);
  
  return publicUrl;
}

async function generateAndStoreAudio(
  content: any, 
  poiId: string,
  voice: VoiceOption = 'nova',
  supabase: any
): Promise<any> {
  try {
    // Convert core content to speech
    const coreBuffer = await textToSpeech(content.core, voice);
    const coreAudioUrl = await storeAudioFile(supabase, coreBuffer, poiId, 'core', voice);
    
    // Convert secondary content to speech
    const secondaryBuffer = await textToSpeech(content.secondary, voice);
    const secondaryAudioUrl = await storeAudioFile(supabase, secondaryBuffer, poiId, 'secondary', voice);
    
    // Convert tertiary content to speech
    const tertiaryBuffer = await textToSpeech(content.tertiary, voice);
    const tertiaryAudioUrl = await storeAudioFile(supabase, tertiaryBuffer, poiId, 'tertiary', voice);
    
    return {
      coreAudioUrl,
      secondaryAudioUrl,
      tertiaryAudioUrl
    };
  } catch (error) {
    console.error('Error generating or storing audio:', error);
    throw error;
  }
}

async function initializeAudioStorage(supabase: any): Promise<void> {
  const bucketName = 'audio-guides';
  
  // Check if bucket exists, create if it doesn't
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((bucket: any) => bucket.name === bucketName);
  
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['audio/mpeg'],
      fileSizeLimit: 50000000 // 50MB limit
    });
    
    if (error) {
      console.error('Error creating storage bucket:', error);
      throw error;
    }
    
    console.log('Created audio-guides storage bucket');
  }
} 