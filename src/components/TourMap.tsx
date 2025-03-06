'use client';

import { useEffect, useState } from 'react';

// Define props for the TourMap component
interface TourMapProps {
  tourRoute: any[];
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  readOnly?: boolean;
}

export default function TourMap({ tourRoute, startLocation, endLocation, readOnly = false }: TourMapProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // This is a simplified placeholder for a real map
  return (
    <div className="relative w-full h-full bg-gray-100 rounded-md">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p>Loading map...</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <p className="text-center mb-4">
            Map Placeholder - In production, this would show an interactive map with {tourRoute.length} stops.
          </p>
          <p className="text-sm text-gray-500">
            Start location: {startLocation.lat.toFixed(4)}, {startLocation.lng.toFixed(4)}
          </p>
          {tourRoute.map((poi, index) => (
            <p key={poi.place_id || index} className="text-sm text-gray-500">
              Stop {index + 1}: {poi.name}
            </p>
          ))}
          <p className="text-sm text-gray-500">
            End location: {endLocation.lat.toFixed(4)}, {endLocation.lng.toFixed(4)}
          </p>
          {readOnly && <p className="text-xs italic mt-4">This map is in read-only mode</p>}
        </div>
      )}
    </div>
  );
} 