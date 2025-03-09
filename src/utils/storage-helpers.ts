import { createClient } from '@/utils/supabase/server';

/**
 * Generate a signed URL for an audio file stored in Supabase Storage
 * @param path - The storage path (without bucket name)
 * @param expirySeconds - Number of seconds until the URL expires (default: 1 hour)
 * @returns The signed URL for the audio file
 */
export async function generateSignedUrl(path: string, expirySeconds: number = 3600): Promise<string | null> {
  try {
    if (!path) return null;
    
    // Create the Supabase client
    const supabase = await createClient();
    
    // Generate a signed URL with the specified expiry
    const { data, error } = await supabase
      .storage
      .from('audio-guides') // Bucket name is hardcoded
      .createSignedUrl(path, expirySeconds);
    
    if (error) {
      console.error('Error generating signed URL:', error);
      // Try to get public URL as fallback
      return getPublicUrl(path);
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Exception generating signed URL:', error);
    // Try to get public URL as fallback
    return getPublicUrl(path);
  }
}

/**
 * Get a public URL for a file in Supabase storage (fallback option)
 * @param path - The storage path (without bucket name)
 * @returns The public URL for the file
 */
function getPublicUrl(path: string): string | null {
  try {
    if (!path) return null;
    
    // Construct public URL
    // Note: This will only work for publicly accessible buckets/files
    return `https://uzqollduvddowyzjvmzn.supabase.co/storage/v1/object/public/audio-guides/${path}`;
  } catch (error) {
    console.error('Error generating public URL:', error);
    return null;
  }
} 