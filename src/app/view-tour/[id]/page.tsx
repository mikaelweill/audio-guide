'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaMapMarkerAlt, FaWalking, FaRoute, FaClock, FaArrowLeft, FaMapMarked, FaTag } from 'react-icons/fa';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AudioGuideControls from '@/components/AudioGuideControls';

// Dynamically import the map component to avoid server-side rendering issues
const TourMap = dynamic(() => import('@/components/TourMap'), { ssr: false });

type ViewTourPageProps = {
  params: {
    id: string;
  };
};

export default function ViewTourPage({ params }: ViewTourPageProps) {
  const router = useRouter();
  const [tour, setTour] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the specific tour from localStorage
    try {
      const savedToursJson = localStorage.getItem('saved-tours');
      if (savedToursJson) {
        const tours = JSON.parse(savedToursJson);
        const foundTour = tours.find((t: any) => t.id === params.id);
        
        if (foundTour) {
          setTour(foundTour);
        } else {
          setError('Tour not found');
        }
      } else {
        setError('No saved tours found');
      }
    } catch (err) {
      console.error('Failed to load tour:', err);
      setError('Failed to load tour data');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl py-8 px-4">
        <p>Loading tour details...</p>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="container mx-auto max-w-7xl py-8 px-4">
        <div className="flex flex-col space-y-4 items-start">
          <h1 className="text-2xl font-bold">Error</h1>
          <p>{error || 'Tour not found'}</p>
          <Link href="/saved-tours">
            <button className="flex items-center bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded">
              <FaArrowLeft className="mr-2" />
              Back to Saved Tours
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Format durations and distances
  const formattedDistance = (tour.stats?.distance
    ? (tour.stats.distance / 1000).toFixed(1)
    : (tour.preferences.distance / 1000).toFixed(1)) + ' km';
    
  const formattedDuration = tour.stats?.duration
    ? `${Math.round(tour.stats.duration / 60)} min`
    : `${tour.preferences.duration} min`;

  const formattedDate = new Date(tour.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="flex flex-col space-y-8">
        <div className="flex justify-between items-center">
          <Link href="/saved-tours">
            <button className="flex items-center border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded">
              <FaArrowLeft className="mr-2" />
              Back to Saved Tours
            </button>
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold">{tour.name}</h1>
        
        {tour.description && (
          <p className="text-lg">{tour.description}</p>
        )}
        
        <div className="flex flex-wrap gap-6">
          <div className="flex-1 min-w-[300px]">
            <div className="flex flex-col space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-4">Tour Details</h2>
                <ul className="space-y-3">
                  <li>
                    <div className="flex items-center">
                      <FaMapMarkerAlt className="text-teal-500 mr-2" />
                      <span className="font-bold mr-2">Start:</span>
                      <span>{tour.preferences.startLocation.address}</span>
                    </div>
                  </li>
                  
                  {!tour.preferences.returnToStart && (
                    <li>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-teal-500 mr-2" />
                        <span className="font-bold mr-2">End:</span>
                        <span>{tour.preferences.endLocation.address}</span>
                      </div>
                    </li>
                  )}
                  
                  <li>
                    <div className="flex items-center">
                      <FaRoute className="text-teal-500 mr-2" />
                      <span className="font-bold mr-2">Distance:</span>
                      <span>{formattedDistance}</span>
                    </div>
                  </li>
                  
                  <li>
                    <div className="flex items-center">
                      <FaClock className="text-teal-500 mr-2" />
                      <span className="font-bold mr-2">Duration:</span>
                      <span>{formattedDuration}</span>
                    </div>
                  </li>
                  
                  <li>
                    <div className="flex items-center">
                      <FaWalking className="text-teal-500 mr-2" />
                      <span className="font-bold mr-2">Stops:</span>
                      <span>{tour.stats?.poiCount || tour.route.length}</span>
                    </div>
                  </li>
                  
                  <li>
                    <div className="flex items-start">
                      <FaTag className="text-teal-500 mr-2 mt-1" />
                      <span className="font-bold mr-2">Interests:</span>
                      <span>{tour.preferences.interests.join(', ')}</span>
                    </div>
                  </li>
                  
                  <li>
                    <div className="flex items-center">
                      <FaMapMarked className="text-teal-500 mr-2" />
                      <span className="font-bold mr-2">Created:</span>
                      <span>{formattedDate}</span>
                    </div>
                  </li>
                </ul>
              </div>
              
              <div>
                <h2 className="text-xl font-bold mb-4">Points of Interest</h2>
                <ul className="space-y-3">
                  {tour.route.map((poi: any, index: number) => (
                    <li key={poi.place_id || index}>
                      <div className="flex items-start">
                        <FaMapMarkerAlt className="text-teal-500 mr-2 mt-1" />
                        <div>
                          <p className="font-bold">{poi.name}</p>
                          <p className="text-sm text-gray-600">
                            {poi.types?.filter((t: string) => !t.includes('_')).join(', ')}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Add Audio Guide Controls */}
              <AudioGuideControls tour={tour} />
            </div>
          </div>
          
          <div className="flex-2 min-w-[300px] h-[60vh] rounded-md overflow-hidden">
            {/* Map will be rendered here */}
            {tour && (
              <TourMap
                tourRoute={tour.route}
                startLocation={tour.preferences.startLocation.position}
                endLocation={tour.preferences.returnToStart 
                  ? tour.preferences.startLocation.position 
                  : tour.preferences.endLocation.position}
                readOnly={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 