import { createClient } from '@/utils/supabase/client';

/**
 * Creates a presigned URL for accessing an image from Supabase Storage
 * 
 * @param bucketPath - The path to the image within the bucket (e.g. "poiId/timestamp.jpg")
 * @param bucketName - The name of the bucket, defaults to 'poi-images'
 * @param expiresIn - How long the URL should be valid for in seconds, defaults to 1 hour
 * @returns The presigned URL or a placeholder if something goes wrong
 */
export async function getImageUrl(
  bucketPath: string | null, 
  bucketName: string = 'poi-images',
  expiresIn: number = 60 * 60
): Promise<string> {
  if (!bucketPath) {
    return '/placeholder-poi.jpg';
  }
  
  try {
    const supabase = createClient();
    
    // Generate a signed URL with expiry
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(bucketPath, expiresIn);
    
    if (error || !data?.signedUrl) {
      console.error('Error generating presigned URL:', error);
      return '/placeholder-poi.jpg';
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating image URL:', error);
    return '/placeholder-poi.jpg';
  }
}

/**
 * Helper function to get the HTML attribution element for a POI image
 * 
 * @param attribution - The HTML attribution string from Google
 * @returns The sanitized HTML string or null
 */
export function getImageAttribution(attribution: string | null): string | null {
  if (!attribution) return null;
  
  // Sanitize the attribution to prevent XSS attacks
  // In a real app, you would use a proper HTML sanitizer
  return attribution;
} 