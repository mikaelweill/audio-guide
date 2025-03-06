import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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
    // This bypasses user authentication issues
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Supabase URL is not configured' },
        { status: 500 }
      );
    }
    
    // Create a Supabase client with the service role key
    // NOTE: This has admin privileges, so be careful!
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
      
      // Since we're debugging, let's use shorter test content
      // to avoid hitting OpenAI rate limits
      const debugContent = {
        core: "This is a short test for the audio guide.",
        secondary: "This is a slightly longer sample for the audio guide.",
        tertiary: "This is the longest test sample for the audio guide."
      };
      
      // Convert all content to speech and store
      const audioFiles = await generateAndStoreAudio(debugContent, poiId, voice, supabaseAdmin, openai);
      
      return NextResponse.json({ audioFiles });
    } catch (storageError: any) {
      console.error('Supabase storage error:', storageError);
      console.error('Error details:', JSON.stringify(storageError, null, 2));
      
      // Return a more specific error based on the type
      if (storageError.message?.includes('Permission denied') || storageError.message?.includes('violates row-level security policy')) {
        return NextResponse.json(
          { 
            error: 'Storage permission denied even with service role key.',
            details: storageError.message,
          },
          { status: 403 }
        );
      } else if (storageError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Storage bucket not found. Make sure the bucket "audio-guides" exists.',
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
    console.error('Full error details:', JSON.stringify(error, null, 2));
    
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
  contentType: 'core' | 'secondary' | 'tertiary',
  voice: VoiceOption
): Promise<string> {
  const fileName = `${poiId}/${contentType}_${voice}_${Date.now()}.mp3`;
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

async function generateAndStoreAudio(
  content: any, 
  poiId: string,
  voice: VoiceOption = 'nova',
  supabase: any,
  openai: OpenAI
): Promise<any> {
  try {
    // Convert core content to speech
    const coreBuffer = await textToSpeech(content.core, voice, openai);
    const coreAudioUrl = await storeAudioFile(supabase, coreBuffer, poiId, 'core', voice);
    
    // Convert secondary content to speech
    const secondaryBuffer = await textToSpeech(content.secondary, voice, openai);
    const secondaryAudioUrl = await storeAudioFile(supabase, secondaryBuffer, poiId, 'secondary', voice);
    
    // Convert tertiary content to speech
    const tertiaryBuffer = await textToSpeech(content.tertiary, voice, openai);
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