// Define the POI interface
export interface TourPoi {
  id: string;
  sequence_number: number;
  poi: {
    id: string;
    name: string;
    formatted_address: string;
    location: { lat: number; lng: number };
    types: string[];
    rating: number | null;
    photo_references: string[] | null;
    website?: string | null;
    thumbnail_url?: string | null;
    image_attribution?: string | null;
  };
}

// Define the Tour interface
export interface Tour {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  last_updated_at: string;
  start_location: { lat: number; lng: number; address?: string };
  end_location: { lat: number; lng: number; address?: string };
  return_to_start: boolean;
  transportation_mode: string;
  total_distance: number;
  total_duration: number;
  google_maps_url: string | null;
  tourPois: TourPoi[];
}

// Define the AudioData interface
export interface AudioData {
  brief: string;
  detailed: string;
  complete: string;
}

// Define the OfflineTour interface for storing downloaded tours
export interface DownloadedTour {
  id: string;
  tour: Tour;
  downloadedAt: number;
  audioResources: string[]; // Array of cache keys for audio files
  imageResources: string[]; // Array of cache keys for images
}

// Define the CachedResource interface for tracking cached resources
export interface CachedResource {
  url: string;     // Original URL
  cacheKey: string; // Key used to store in the cache
  contentType: string; // MIME type
  size: number;    // Size in bytes
  timestamp: number; // When it was cached
} 