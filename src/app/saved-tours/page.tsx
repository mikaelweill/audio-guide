'use client';

import { useState, useEffect } from 'react';
import { FaCalendar, FaMapMarkerAlt, FaWalking, FaRoute, FaClock } from 'react-icons/fa';
import Link from 'next/link';

type SavedTour = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  route: Array<any>;
  preferences: {
    interests: string[];
    duration: number;
    distance: number;
    startLocation: {
      position: { lat: number; lng: number };
      address: string;
      useCurrentLocation: boolean;
    };
    endLocation: {
      position: { lat: number; lng: number };
      address: string;
      useCurrentLocation: boolean;
    };
    returnToStart: boolean;
    transportationMode: string;
  };
  stats: {
    distance: number;
    duration: number;
    poiCount: number;
  };
};

export default function SavedToursPage() {
  const [savedTours, setSavedTours] = useState<SavedTour[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load saved tours from localStorage
    try {
      const savedToursJson = localStorage.getItem('saved-tours');
      if (savedToursJson) {
        const tours = JSON.parse(savedToursJson);
        setSavedTours(tours);
      }
    } catch (error) {
      console.error('Failed to load saved tours:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteTour = (tourId: string) => {
    try {
      // Filter out the tour to delete
      const updatedTours = savedTours.filter(tour => tour.id !== tourId);
      
      // Update localStorage
      localStorage.setItem('saved-tours', JSON.stringify(updatedTours));
      
      // Update state
      setSavedTours(updatedTours);
      
      alert('Tour deleted successfully');
    } catch (error) {
      console.error('Failed to delete tour:', error);
      alert('Failed to delete tour');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Saved Tours</h1>
      
      {isLoading ? (
        <p>Loading saved tours...</p>
      ) : savedTours.length === 0 ? (
        <div className="text-center py-10">
          <h3 className="text-lg font-medium mb-4">No saved tours found</h3>
          <p className="mb-6">You haven't saved any tours yet.</p>
          <Link href="/" passHref>
            <button className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded">
              Create a tour
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedTours.map((tour) => (
            <div key={tour.id} className="overflow-hidden border rounded-lg shadow">
              <div className="bg-teal-500 text-white py-3 px-4">
                <h2 className="text-md font-bold">{tour.name}</h2>
              </div>
              
              <div className="p-4">
                <div className="flex flex-col space-y-4">
                  {tour.description && (
                    <p className="line-clamp-2">{tour.description}</p>
                  )}
                  
                  <div className="flex items-center">
                    <FaCalendar className="mr-2" />
                    <span>{formatDate(tour.createdAt)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <FaMapMarkerAlt className="mr-2" />
                      <span className="font-bold mr-2">Start:</span>
                      <span className="truncate">{tour.preferences.startLocation.address}</span>
                    </div>
                    
                    {!tour.preferences.returnToStart && (
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="mr-2" />
                        <span className="font-bold mr-2">End:</span>
                        <span className="truncate">{tour.preferences.endLocation.address}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-4">
                    <div className="flex items-center">
                      <FaRoute className="mr-2" />
                      <span>
                        {tour.stats?.distance
                          ? `${(tour.stats.distance / 1000).toFixed(1)} km`
                          : `${(tour.preferences.distance / 1000).toFixed(1)} km`}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <FaClock className="mr-2" />
                      <span>
                        {tour.stats?.duration
                          ? `${Math.round(tour.stats.duration / 60)} min`
                          : `${tour.preferences.duration} min`}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <FaWalking className="mr-2" />
                      <span>
                        {tour.stats?.poiCount || tour.route.length} stops
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-bold mb-1">Interests:</p>
                    <div className="flex flex-wrap gap-2">
                      {tour.preferences.interests.map((interest, idx) => (
                        <span key={idx} className="bg-teal-100 text-teal-700 px-2 py-1 text-xs rounded">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-2">
                    <Link href={`/view-tour/${tour.id}`} passHref>
                      <button className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 text-sm rounded">
                        View Tour
                      </button>
                    </Link>
                    
                    <button 
                      className="border border-red-500 text-red-500 hover:bg-red-50 px-3 py-1 text-sm rounded"
                      onClick={() => handleDeleteTour(tour.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 