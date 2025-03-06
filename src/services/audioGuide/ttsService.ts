/**
 * Text-to-Speech Service
 * 
 * Converts text content to audio files and manages storage in Supabase
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { AudioGuideContent } from './contentGenerationService';

// Don't initialize clients globally - will do it per-function
// to support both server and client-side usage

// Voice options
export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface AudioFiles {
  coreAudioUrl: string;
  secondaryAudioUrl: string;
  tertiaryAudioUrl: string;
}

// Helper to get an OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Please add it to your environment variables.');
  }
  
  return new OpenAI({ apiKey });
}

// Helper to get a Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are missing. Please add them to your environment variables.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Convert text to speech using OpenAI's TTS API
 */
async function textToSpeech(text: string, voice: VoiceOption = 'nova'): Promise<Buffer> {
  const openai = getOpenAIClient();
  
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: text,
  });
  
  // Convert the response to a buffer
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

/**
 * Store audio file in Supabase storage
 */
async function storeAudioFile(
  fileBuffer: Buffer, 
  poiId: string, 
  contentType: 'core' | 'secondary' | 'tertiary',
  voice: VoiceOption
): Promise<string> {
  const supabase = getSupabaseClient();
  
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

/**
 * Process all content layers and convert to audio
 */
export async function generateAndStoreAudio(
  content: AudioGuideContent, 
  poiId: string,
  voice: VoiceOption = 'nova'
): Promise<AudioFiles> {
  try {
    // Convert core content to speech
    const coreBuffer = await textToSpeech(content.core, voice);
    const coreAudioUrl = await storeAudioFile(coreBuffer, poiId, 'core', voice);
    
    // Convert secondary content to speech
    const secondaryBuffer = await textToSpeech(content.secondary, voice);
    const secondaryAudioUrl = await storeAudioFile(secondaryBuffer, poiId, 'secondary', voice);
    
    // Convert tertiary content to speech
    const tertiaryBuffer = await textToSpeech(content.tertiary, voice);
    const tertiaryAudioUrl = await storeAudioFile(tertiaryBuffer, poiId, 'tertiary', voice);
    
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

/**
 * Initialize Supabase storage bucket for audio guides
 */
export async function initializeAudioStorage(): Promise<void> {
  const supabase = getSupabaseClient();
  const bucketName = 'audio-guides';
  
  // Check if bucket exists, create if it doesn't
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
  
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

export default {
  generateAndStoreAudio,
  initializeAudioStorage
}; 