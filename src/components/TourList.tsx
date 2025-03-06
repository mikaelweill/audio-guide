'use client';

import { useState } from 'react';
import Link from 'next/link';

// Tour type definition
interface TourPoi {
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
  };
}

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

interface TourListProps {
  tours: Tour[];
  loading: boolean;
}

export default function TourList({ tours, loading }: TourListProps) {
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);

  const toggleExpand = (tourId: string) => {
    setExpandedTourId(expandedTourId === tourId ? null : tourId);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 p-6 rounded-lg animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg mt-6 text-center">
        <h3 className="text-lg font-medium text-gray-600 mb-2">No tours yet</h3>
        <p className="text-gray-500 mb-4">Create your first personalized tour to see it here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {tours.map((tour) => (
        <div 
          key={tour.id} 
          className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          <div 
            className="p-4 cursor-pointer flex justify-between items-center"
            onClick={() => toggleExpand(tour.id)}
          >
            <div>
              <h3 className="text-lg font-medium text-gray-800">{tour.name}</h3>
              <div className="flex items-center mt-1 text-sm text-gray-500">
                <span>{formatDate(tour.created_at)}</span>
                <span className="mx-2">•</span>
                <span>{(tour.total_distance).toFixed(1)} km</span>
                <span className="mx-2">•</span>
                <span>{formatDuration(tour.total_duration)}</span>
              </div>
            </div>
            <div className="text-gray-400">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 transition-transform ${expandedTourId === tour.id ? 'transform rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {expandedTourId === tour.id && (
            <div className="border-t border-gray-200 p-4">
              {tour.description && (
                <p className="text-gray-600 text-sm mb-4">{tour.description}</p>
              )}
              
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700">Tour Stops</h4>
                <div className="space-y-2">
                  {tour.tourPois
                    .sort((a, b) => a.sequence_number - b.sequence_number)
                    .map((tourPoi) => (
                      <div key={tourPoi.id} className="flex items-start">
                        <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2 mt-0.5">
                          {tourPoi.sequence_number + 1}
                        </div>
                        <div>
                          <h5 className="text-gray-800 font-medium">{tourPoi.poi.name}</h5>
                          <p className="text-gray-500 text-sm">{tourPoi.poi.formatted_address}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="mt-6 flex justify-between">
                {tour.google_maps_url && (
                  <a 
                    href={tour.google_maps_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    Open in Google Maps
                  </a>
                )}

                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
                  onClick={() => {
                    // Start tour logic here
                    alert('Start tour functionality will be implemented next');
                  }}
                >
                  Start Tour
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 