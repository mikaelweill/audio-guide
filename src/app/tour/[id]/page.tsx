'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tour } from '@/components/TourList';
import { dataCollectionService } from '@/services/audioGuide';

export default function TourPage() {
  const params = useParams();
  const router = useRouter();
  const tourId = params.id as string;
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State to track the current stop in the tour
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  
  // Audio guide generation states
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioData, setAudioData] = useState<Record<string, any>>({});
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerationStep, setCurrentGenerationStep] = useState('');
  
  // Fetch tour data
  useEffect(() => {
    const fetchTour = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/tours/${tourId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching tour: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.tour) {
          setTour(data.tour);
        } else {
          setError(data.error || 'Failed to load tour data');
        }
      } catch (error) {
        console.error('Error fetching tour:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    if (tourId) {
      fetchTour();
    }
  }, [tourId]);
  
  // Navigate to the next or previous stop
  const goToStop = (index: number) => {
    if (tour && tour.tourPois.length > 0) {
      if (index >= 0 && index < tour.tourPois.length) {
        setCurrentStopIndex(index);
      }
    }
  };
  
  // Format duration for display
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };
  
  // Function to generate audio guides for all POIs in the tour
  const handleGenerateAudioGuides = async () => {
    if (!tour || !tour.tourPois || tour.tourPois.length === 0) {
      alert('No POIs found in this tour');
      return;
    }

    setIsGeneratingAudio(true);
    setCurrentGenerationStep('Starting audio guide generation...');
    setGenerationProgress(0);

    try {
      const audioResults: Record<string, any> = {};
      const totalPois = tour.tourPois.length;
      const sortedPois = [...tour.tourPois].sort((a, b) => a.sequence_number - b.sequence_number);

      // Process each POI in the tour
      for (let i = 0; i < totalPois; i++) {
        const poiData = sortedPois[i].poi;
        const progressPercent = Math.round((i / totalPois) * 100);
        setGenerationProgress(progressPercent);
        
        setCurrentGenerationStep(`Collecting data for ${poiData.name} (${i + 1}/${totalPois})...`);
        
        // 1. Collect data from sources
        const enrichedPoiData = await dataCollectionService.collectPoiData({
          name: poiData.name,
          formatted_address: poiData.formatted_address || '',
          location: poiData.location || null,
          types: poiData.types || [],
          rating: poiData.rating,
          photo_references: poiData.photo_references || []
        });

        setCurrentGenerationStep(`Generating content for ${poiData.name} (${i + 1}/${totalPois})...`);
        
        // 2. Generate content using the server-side API
        const contentResponse = await fetch('/api/content-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ poiData: enrichedPoiData }),
        });

        if (!contentResponse.ok) {
          throw new Error(`Failed to generate content for ${poiData.name}`);
        }

        const contentData = await contentResponse.json();
        
        setCurrentGenerationStep(`Converting to speech for ${poiData.name} (${i + 1}/${totalPois})...`);
        
        // 3. Convert to speech using the server-side API
        const ttsResponse = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: contentData.content,
            poiId: poiData.id || `poi-${i}`,
            voice: 'nova', // Default voice
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`Failed to convert text to speech for ${poiData.name}`);
        }

        const audioFiles = await ttsResponse.json();
        
        // Store the results
        audioResults[poiData.id || `poi-${i}`] = {
          name: poiData.name,
          content: contentData.content,
          audioFiles: audioFiles.audioFiles,
        };
      }

      setAudioData(audioResults);
      setCurrentGenerationStep('');
      setGenerationProgress(100);
      
      alert(`Generated audio guides for ${totalPois} POIs`);
    } catch (error) {
      console.error('Error generating audio guides:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate audio guides');
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Loading tour...</p>
      </div>
    );
  }
  
  if (error || !tour) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error || 'Tour not found'}</p>
          <Link 
            href="/"
            className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }
  
  // Sort tour POIs by sequence number
  const sortedPois = [...tour.tourPois].sort((a, b) => a.sequence_number - b.sequence_number);
  const currentStop = sortedPois[currentStopIndex];
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Tour Header */}
      <div className="bg-blue-600 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{tour.name}</h1>
              <p className="text-blue-100 mt-1">
                {tour.tourPois.length} stops • {(tour.total_distance).toFixed(1)} km • {formatDuration(tour.total_duration)}
              </p>
            </div>
            <Link
              href="/"
              className="text-white hover:text-blue-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Audio Guide Generation Button - Parent level control */}
        {!isGeneratingAudio && Object.keys(audioData).length === 0 && (
          <div className="bg-blue-50 p-4 rounded-lg shadow-sm mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z"></path>
                </svg>
                <h3 className="font-semibold text-lg">Audio Tour Guides</h3>
              </div>
              <button 
                onClick={handleGenerateAudioGuides}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                </svg>
                Generate Audio For All Stops
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Generate audio guides for all stops on this tour. This will create audio content you can listen to at each location.
            </p>
          </div>
        )}
        
        {/* Generation Progress Indicator */}
        {isGeneratingAudio && (
          <div className="bg-blue-50 p-4 rounded-lg shadow-sm mb-8">
            <h3 className="font-semibold text-lg mb-3 flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Audio Guides
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all" 
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">{currentGenerationStep}</p>
            <p className="text-sm text-gray-500 mt-1">This may take a few minutes. Please don't close this page.</p>
          </div>
        )}
        
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${(currentStopIndex / Math.max(1, tour.tourPois.length - 1)) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Start</span>
            <span>Finish</span>
          </div>
        </div>
        
        {/* Current Stop */}
        {currentStop && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold text-gray-900">
                  Stop {currentStopIndex + 1}: {currentStop.poi.name}
                </h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {currentStopIndex + 1}/{sortedPois.length}
                </span>
              </div>
              
              <p className="text-gray-600 mt-1">{currentStop.poi.formatted_address}</p>
              
              {currentStop.poi.rating && (
                <div className="flex items-center mt-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg 
                        key={i}
                        className={`w-4 h-4 ${i < Math.round(currentStop.poi.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-gray-500 ml-1">{currentStop.poi.rating}</span>
                </div>
              )}
            </div>
            
            {/* Placeholder for POI Image */}
            <div className="h-64 bg-gray-300 flex items-center justify-center">
              {currentStop.poi.photo_references && currentStop.poi.photo_references.length > 0 ? (
                <img 
                  src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${currentStop.poi.photo_references[0]}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                  alt={currentStop.poi.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            
            {/* Content Section */}
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">About this location</h3>
              <p className="text-gray-600 mb-4">
                {Object.keys(audioData).length > 0 ? 
                  "Audio guides for this location are ready to play below." : 
                  "Audio guide content for this location will be generated and displayed here."}
              </p>
              
              {/* Audio Player Section */}
              {Object.keys(audioData).length > 0 && audioData[currentStop.poi.id || `poi-${currentStopIndex}`] ? (
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  <div className="flex flex-col space-y-2">
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded flex items-center justify-center"
                      onClick={() => {
                        const audio = new Audio(audioData[currentStop.poi.id || `poi-${currentStopIndex}`].audioFiles.coreAudioUrl);
                        audio.play();
                      }}
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                      </svg>
                      Play Brief Overview (30-60s)
                    </button>
                    
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded flex items-center justify-center"
                      onClick={() => {
                        const audio = new Audio(audioData[currentStop.poi.id || `poi-${currentStopIndex}`].audioFiles.secondaryAudioUrl);
                        audio.play();
                      }}
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                      </svg>
                      Play Detailed Guide (1-2 min)
                    </button>
                    
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded flex items-center justify-center"
                      onClick={() => {
                        const audio = new Audio(audioData[currentStop.poi.id || `poi-${currentStopIndex}`].audioFiles.tertiaryAudioUrl);
                        audio.play();
                      }}
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                      </svg>
                      Play In-Depth Exploration (3+ min)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <button className="bg-blue-500 text-white rounded-full p-2 mr-3 opacity-50 cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <div>
                      <p className="font-medium text-gray-800">Audio Guide</p>
                      <p className="text-sm text-gray-500">Generate audio guides using the button at the top</p>
                    </div>
                  </div>
                  <div className="text-gray-500">--:--</div>
                </div>
              )}
              
              {/* Google Maps Link */}
              <a 
                href={`https://www.google.com/maps/place/?q=place_id:${currentStop.poi.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 inline-flex items-center mb-4"
              >
                <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                View in Google Maps
              </a>
            </div>
          </div>
        )}
        
        {/* Navigation Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between">
            <button
              onClick={() => goToStop(currentStopIndex - 1)}
              disabled={currentStopIndex === 0}
              className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                currentStopIndex === 0 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            
            <button
              onClick={() => goToStop(currentStopIndex + 1)}
              disabled={currentStopIndex === sortedPois.length - 1}
              className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                currentStopIndex === sortedPois.length - 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 