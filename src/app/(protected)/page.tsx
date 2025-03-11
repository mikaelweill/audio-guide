'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import TourModal from '@/components/TourModal';
import TourList, { Tour } from '@/components/TourList';
import { toast } from 'react-hot-toast';

// Extract tour fetching logic to a separate client component
function TourLoader({ onToursLoaded }: { onToursLoaded: (tours: Tour[], pagination?: { total: number, pages: number }) => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTours, setTotalTours] = useState(0);
  const [limit] = useState(6);
  const subscriptionRef = useRef(null);
  
  const fetchTours = async (page = 1, limit = 6) => {
    console.log(`🔄 TOUR LOADER: Fetching tours for page ${page} with limit ${limit}`);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/tours?page=${page}&limit=${limit}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: Failed to load tours`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.tours)) {
        console.log(`✅ TOUR LOADER: Loaded ${data.tours.length} tours (page ${page} of ${data.pagination?.pages || 1})`);
        setTours(data.tours);
        setCurrentPage(data.pagination?.page || page);
        setTotalPages(data.pagination?.pages || 1);
        setTotalTours(data.pagination?.total || data.tours.length);
        
        // Pass both tours and pagination data
        onToursLoaded(data.tours, data.pagination);
        
        // Enable realtime subscription if not already set up
        if (!subscriptionRef.current) {
          const { createClient } = require('@/utils/supabase/client');
          const supabase = createClient();
          
          const channel = supabase.channel('tour-changes')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'Tour',
              },
              (payload: any) => {
                console.log('🔌 REALTIME: Tour change detected', payload);
                fetchTours(currentPage, limit);
              }
            )
            .subscribe();
          
          subscriptionRef.current = channel;
        }
      } else {
        console.error('❌ TOUR LOADER: Invalid tour data format');
        setError('Invalid tour data format');
      }
    } catch (err: any) {
      console.error('❌ TOUR LOADER: Error fetching tours', err);
      setError(err.message || 'Failed to load tours');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load tours on mount
  useEffect(() => {
    fetchTours(currentPage, limit);
    
    // Clean up subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        console.log('🔌 Cleaning up Supabase real-time subscription');
        const { createClient } = require('@/utils/supabase/client');
        const supabase = createClient();
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [currentPage, limit]);
  
  return null; // This component is just for data fetching
}

// CSS for Globe and Map Styling
const globeStyles = `
  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  .globe {
    position: relative;
    width: 300px;
    height: 300px;
    margin: 0 auto;
    border-radius: 50%;
    background: 
      radial-gradient(circle at 100px 100px, rgba(99, 102, 241, 0.1), transparent),
      linear-gradient(rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9)),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='none' stroke='rgba(99, 102, 241, 0.2)' stroke-width='1'%3E%3Cpath d='M0,400 Q200,100 400,400 T800,400'/%3E%3Cpath d='M0,450 Q200,150 400,450 T800,450'/%3E%3Cpath d='M0,500 Q200,200 400,500 T800,500'/%3E%3Cpath d='M0,350 Q200,50 400,350 T800,350'/%3E%3Cpath d='M0,300 Q200,0 400,300 T800,300'/%3E%3C/g%3E%3Cg fill='none' stroke='rgba(99, 102, 241, 0.2)' stroke-width='1'%3E%3Cpath d='M400,0 Q700,200 400,400 T400,800'/%3E%3Cpath d='M450,0 Q750,200 450,400 T450,800'/%3E%3Cpath d='M350,0 Q650,200 350,400 T350,800'/%3E%3Cpath d='M500,0 Q800,200 500,400 T500,800'/%3E%3Cpath d='M300,0 Q600,200 300,400 T300,800'/%3E%3C/g%3E%3C/svg%3E");
    box-shadow:
      inset 0 0 50px rgba(99, 102, 241, 0.2),
      0 0 30px rgba(99, 102, 241, 0.15);
    animation: rotate 60s linear infinite;
    transform-style: preserve-3d;
  }
  
  .globe::before {
    content: '';
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 50%, 
      rgba(99, 102, 241, 0.1) 0%, 
      rgba(99, 102, 241, 0.05) 40%, 
      transparent 70%);
    z-index: -1;
  }
  
  .meridian {
    position: absolute;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }
  
  .meridian:nth-child(1) { transform: rotateY(30deg); }
  .meridian:nth-child(2) { transform: rotateY(60deg); }
  .meridian:nth-child(3) { transform: rotateY(90deg); }
  .meridian:nth-child(4) { transform: rotateX(30deg); }
  .meridian:nth-child(5) { transform: rotateX(60deg); }
  .meridian:nth-child(6) { transform: rotateX(90deg); }
  
  .location-ping {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: rgba(99, 102, 241, 0.8);
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
    transform: translate(-50%, -50%);
    animation: ping 1.5s ease-in-out infinite;
  }
  
  @keyframes ping {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0.8;
    }
    70% {
      transform: translate(-50%, -50%) scale(1.5);
      opacity: 0.2;
    }
    100% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0.8;
    }
  }
  
  .location-ping:nth-child(1) { top: 30%; left: 70%; }
  .location-ping:nth-child(2) { top: 60%; left: 40%; }
  .location-ping:nth-child(3) { top: 40%; left: 20%; }
  
  .audio-wave {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    overflow: hidden;
  }
  
  .wave-line {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: translateZ(0);
  }
  
  .wave-line:nth-child(1) {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M0,0 C150,40 350,0 500,30 C650,60 750,20 900,40 C1050,60 1150,10 1200,30 L1200,120 L0,120 Z' fill='rgba(99, 102, 241, 0.1)'/%3E%3C/svg%3E");
    background-size: 1200px 100%;
    animation: wave-animation 12s linear infinite;
  }
  
  .wave-line:nth-child(2) {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M0,40 C150,10 350,60 500,20 C650,0 750,50 900,20 C1050,0 1150,50 1200,30 L1200,120 L0,120 Z' fill='rgba(99, 102, 241, 0.05)'/%3E%3C/svg%3E");
    background-size: 1200px 100%;
    animation: reverse-wave-animation 9s linear infinite;
  }
  
  @keyframes wave-animation {
    0% { background-position-x: 0; }
    100% { background-position-x: 1200px; }
  }
  
  @keyframes reverse-wave-animation {
    0% { background-position-x: 1200px; }
    100% { background-position-x: 0; }
  }
`;

export default function Home() {
  console.log('🏠 HOME: Component rendering');
  
  // Tours state
  const [tours, setTours] = useState<Tour[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTours, setTotalTours] = useState(0);
  const [toursPerPage] = useState(6);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Navigation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  
  // Google Maps API state
  const libraries = ['places'];
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  // Functions to handle modal
  const openModal = () => {
    console.log('🔍 HOME: Opening tour creation modal');
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    console.log('🔍 HOME: Closing tour creation modal');
    setIsModalOpen(false);
  };
  
  // Function to save a new tour
  const saveTour = (tourData: any) => {
    console.log('💾 HOME: Tour saved:', tourData);
    closeModal();
    // Your existing implementation
  };

  // Handler for pagination
  const handlePageChange = (newPage: number) => {
    console.log(`📄 HOME: Changing to page ${newPage}`);
    setCurrentPage(newPage);
  };
  
  // Update the handleToursLoaded function
  const handleToursLoaded = (loadedTours: Tour[], pagination?: { total: number, pages: number }) => {
    console.log(`✅ HOME: ${loadedTours.length} tours loaded`);
    setTours(loadedTours);
    
    // Update pagination information if provided
    if (pagination) {
      setTotalTours(pagination.total);
      setTotalPages(pagination.pages);
    }
  };
  
  // Get user's current location when component mounts
  useEffect(() => {
    const requestUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
            // User declined to share location or other error
            console.log('Could not access your location');
          }
        );
      } else {
        // Browser doesn't support geolocation
        console.log('Geolocation is not supported by your browser');
      }
    };
    
    // Request location when component mounts
    requestUserLocation();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Globe Styles */}
      <style dangerouslySetInnerHTML={{ __html: globeStyles }} />
      
      {/* Tour data loader */}
      <TourLoader onToursLoaded={handleToursLoaded} />
      
      {/* Main container */}
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section with Globe */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 shadow-xl mb-12 border border-slate-700">
          <div className="p-6 md:p-12 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="lg:w-1/2 text-center lg:text-left">
                <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">
                    Audio Travel Guides
                  </span>
                </h1>
                
                <p className="text-lg max-w-xl mx-auto lg:mx-0 mb-8 text-gray-300">
                  Explore the world through intelligent voice guides in your preferred language.
                </p>
                
                <button 
                  onClick={openModal}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg 
                    text-white font-medium shadow-lg shadow-indigo-500/25 
                    transition-all duration-300 flex items-center mx-auto lg:mx-0"
                >
                  <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  Generate Audio Guide
                </button>
              </div>
              
              <div className="lg:w-1/2 mt-8 lg:mt-0 perspective relative">
                <div className="globe">
                  <div className="meridian"></div>
                  <div className="meridian"></div>
                  <div className="meridian"></div>
                  <div className="meridian"></div>
                  <div className="meridian"></div>
                  <div className="meridian"></div>
                  
                  <div className="location-ping"></div>
                  <div className="location-ping"></div>
                  <div className="location-ping"></div>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 h-12">
                  <div className="audio-wave">
                    <div className="wave-line"></div>
                    <div className="wave-line"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full translate-y-1/3 -translate-x-1/3 blur-3xl"></div>
        </div>
        
        {/* Tours Section */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-md mb-12 relative">
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
          
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-100 flex items-center">
                <span className="w-1 h-6 bg-indigo-500 rounded-full mr-2 inline-block"></span>
                {tours.length > 0 ? "Your Audio Guides" : "Start Exploring"}
              </h2>
            </div>
            
            {tours.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="inline-block p-4 bg-indigo-900/30 rounded-full mb-4">
                  <svg className="w-10 h-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-100 mb-2">No Audio Guides Yet</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Create your first personalized audio guide by selecting a location.
                </p>
                <button 
                  onClick={openModal}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg
                    shadow-md transition-all duration-300"
                >
                  Create Your First Guide
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-4">
                  <TourList tours={tours} loading={false} />
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center space-x-2 mt-4">
                    <button
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded-md flex items-center 
                        ${currentPage === 1 
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="px-3 py-1 bg-slate-800 rounded-md text-white">
                      {currentPage} / {totalPages}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded-md flex items-center
                        ${currentPage === totalPages 
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Tour modal */}
      <TourModal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        onSave={(tourData) => {
          // First close the modal immediately
          closeModal();
          // Then handle the saving separately
          saveTour(tourData);
        }}
        userLocation={userLocation || undefined}
        mapsApiLoaded={isLoaded}
      />
    </div>
  );
} 