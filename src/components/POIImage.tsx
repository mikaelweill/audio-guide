'use client';

import { useState, useEffect } from 'react';
import { getImageUrl } from '@/utils/images';

interface POIImageProps {
  imagePath: string;
  attribution: string | null;
  altText: string;
}

/**
 * Component to display a POI image with attribution
 * Generates a presigned URL from the image path
 */
export default function POIImage({ imagePath, attribution, altText }: POIImageProps) {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder-poi.jpg');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadImage() {
      if (imagePath) {
        try {
          const url = await getImageUrl(imagePath);
          setImageUrl(url);
        } catch (error) {
          console.error('Error loading image:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
    
    loadImage();
  }, [imagePath]);
  
  return (
    <div className="relative w-full h-full">
      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <div className="animate-pulse bg-gray-300 w-12 h-12 rounded-full"></div>
        </div>
      ) : (
        <>
          <img 
            src={imageUrl}
            alt={altText}
            className="w-full h-full object-cover"
          />
          
          {/* Display attribution if available */}
          {attribution && (
            <div 
              className="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1"
              dangerouslySetInnerHTML={{ __html: attribution }}
            />
          )}
        </>
      )}
    </div>
  );
} 