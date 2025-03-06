/**
 * Data Collection Service
 * 
 * Combines data from multiple sources for a complete POI profile
 */

import wikipediaService from './wikipediaService';
import wikivoyageService from './wikivoyageService';

export interface PoiData {
  basic: {
    name: string;
    formatted_address: string;
    location: { lat: number; lng: number };
    types?: string[];
    rating?: number;
    user_ratings_total?: number;
    opening_hours?: any;
    photo_references?: string[];
  };
  wikipedia?: {
    title: string;
    extract: string;
    url: string;
    imageUrl?: string;
  };
  wikivoyage?: {
    title: string;
    extract: string;
    seeSection?: string;
    doSection?: string;
    url: string;
  };
  // Additional data sources can be added here
}

/**
 * Collect POI data from all available sources
 */
export async function collectPoiData(poi: any): Promise<PoiData> {
  // Extract POI basics
  const poiName = poi.name;
  const location = poi.location || poi.geometry?.location;
  
  // Prepare the result object with basic info we already have
  const result: PoiData = {
    basic: {
      name: poi.name,
      formatted_address: poi.formatted_address || poi.vicinity || '',
      location: location,
      types: poi.types || [],
      rating: poi.rating,
      user_ratings_total: poi.user_ratings_total,
      opening_hours: poi.opening_hours,
      photo_references: poi.photo_references || []
    }
  };
  
  // Fetch data from Wikipedia
  try {
    const wikipediaData = await wikipediaService.getWikipediaData(poiName, location);
    if (wikipediaData) {
      result.wikipedia = {
        title: wikipediaData.title,
        extract: wikipediaData.extract,
        url: wikipediaData.url,
        imageUrl: wikipediaData.imageUrl
      };
    }
  } catch (error) {
    console.error('Error fetching Wikipedia data:', error);
  }
  
  // Fetch data from Wikivoyage
  try {
    const wikivoyageData = await wikivoyageService.getWikivoyageData(poiName, location);
    if (wikivoyageData) {
      result.wikivoyage = {
        title: wikivoyageData.title,
        extract: wikivoyageData.extract,
        seeSection: wikivoyageData.seeSection,
        doSection: wikivoyageData.doSection,
        url: wikivoyageData.url
      };
    }
  } catch (error) {
    console.error('Error fetching Wikivoyage data:', error);
  }
  
  // You can add more data sources here
  
  return result;
}

/**
 * Analyze collected data and determine which information to prioritize
 */
export function analyzePoiData(poiData: PoiData): {
  quality: 'high' | 'medium' | 'low';
  sources: string[];
  primarySource: string;
} {
  const sources = [];
  let primarySource = 'basic';
  let quality: 'high' | 'medium' | 'low' = 'low';
  
  // Check what sources we have
  if (poiData.wikipedia?.extract && poiData.wikipedia.extract.length > 100) {
    sources.push('wikipedia');
    primarySource = 'wikipedia';
    quality = 'medium';
  }
  
  if (poiData.wikivoyage?.extract || poiData.wikivoyage?.seeSection) {
    sources.push('wikivoyage');
    if (poiData.wikivoyage.seeSection && poiData.wikivoyage.seeSection.length > 200) {
      primarySource = 'wikivoyage';
      quality = 'high';
    }
  }
  
  // If we have both Wikipedia and good Wikivoyage content, quality is high
  if (sources.includes('wikipedia') && sources.includes('wikivoyage')) {
    quality = 'high';
  }
  
  return {
    quality,
    sources,
    primarySource
  };
}

export default {
  collectPoiData,
  analyzePoiData
}; 