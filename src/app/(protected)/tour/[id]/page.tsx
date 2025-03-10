'use client';

import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tour, TourPoi } from '@/components/TourList';
import { dataCollectionService } from '@/services/audioGuide';

// Debug logging
const PAGE_DEBUG = true;
const logPage = (...args: any[]) => {
  if (PAGE_DEBUG) {
    console.log(`📄 TOUR PAGE [${new Date().toISOString().split('T')[1].split('.')[0]}]:`, ...args);
  }
};

export default function TourPage() {
  // Don't log on every render - this causes React DevTools to trigger re-renders
  // logPage('Component rendering');
  const mountCountRef = useRef(0);
  const renderCountRef = useRef(0);
  
  // Track page lifecycle and loading performance
  useEffect(() => {
    renderCountRef.current += 1;
    logPage(`Component rendering (render #${renderCountRef.current})`);
    
    mountCountRef.current += 1;
    logPage(`Mounted (count: ${mountCountRef.current})`);
    
    // Performance tracking from navigation
    if (typeof window !== 'undefined' && window._navTimestamp) {
      const navigationTime = Date.now() - window._navTimestamp;
      logPage(`Page loaded ${navigationTime}ms after navigation started`);
      
      // Clear the timestamp since we've used it
      window._navTimestamp = undefined;
    }
    
    // Log URL parameters and state
    logPage('URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
    logPage('Pathname:', typeof window !== 'undefined' ? window.location.pathname : 'SSR');
    
    // Log cookie state on mount
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
      logPage(`Cookies on mount: ${cookies.join(', ') || 'none'}`);
    }
    
    return () => {
      logPage(`Unmounting (count: ${mountCountRef.current})`);
    };
  }, []);

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
  
  // Audio playback states
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<'brief' | 'detailed' | 'in-depth' | null>(null);
  
  // Add these state variables to your component
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  
  // Add this state variable to track the visible transcript
  const [showTranscript, setShowTranscript] = useState(false);
  
  // Add a ref to track current time without causing re-renders
  const currentTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const TIME_UPDATE_THROTTLE = 250; // Only update time display every 250ms
  
  // Memoize this function to prevent it from being recreated on each render
  const getGoogleMapsUrl = useCallback((poi: any) => {
    // Try using place_id first (most reliable)
    if (poi.id && poi.id.startsWith('ChI')) {
      return `https://www.google.com/maps/place/?q=place_id:${poi.id}`;
    }
    
    // Try using formatted address if available
    if (poi.formatted_address) {
      const encodedAddress = encodeURIComponent(poi.formatted_address);
      return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }
    
    // If we have coordinates, use those as fallback
    if (poi.location && typeof poi.location === 'object' && poi.location.lat && poi.location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${poi.location.lat},${poi.location.lng}`;
    }
    
    // Fallback to using the name if we have it
    if (poi.name) {
      const encodedName = encodeURIComponent(poi.name);
      return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
    }
    
    // Final fallback - generic Google Maps link
    return "https://www.google.com/maps";
  }, []);
  
  // Fetch tour data
  useEffect(() => {
    fetchTour();
  }, [tourId]);
  
  // Add this memoized fetchTour function before the useEffect
  const fetchTour = useCallback(async () => {
    // Create abort controller for timeout management
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('Aborting tour fetch due to timeout');
      controller.abort();
    }, 8000); // 8 second timeout
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        signal: controller.signal // Use the abort controller
      });
      
      // Clear timeout since request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Tour fetch failed with status: ${response.status}`);
        
        // Handle authentication errors specially
        if (response.status === 401) {
          console.error('Authentication error - not logged in or session expired');
          setError('Authentication error: You need to log in again');
          // No need to redirect - protected layout will handle this
          setLoading(false);
          return;
        }
        
        try {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          
          // Try to parse the error as JSON if possible
          try {
            const errorJson = JSON.parse(errorText);
            setError(errorJson.error || `Error ${response.status}: Failed to load tour`);
          } catch (e) {
            // If not JSON, use the raw text
            setError(`Error ${response.status}: ${errorText}`);
          }
        } catch (textError) {
          setError(`Error ${response.status}: Failed to load tour data`);
        }
        
        throw new Error(`Error fetching tour: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.tour) {
        console.log('Tour data fetched successfully');
        setTour(data.tour);
        
        // Once the tour is loaded, fetch any existing audio guides
        fetchExistingAudioGuides(data.tour.tourPois);
        
        // Handle warning about ownership if present
        if (data.warning) {
          console.warn(data.warning);
        }
      } else {
        setError(data.error || 'Failed to load tour data');
      }
    } catch (error: any) {
      // Handle abort error specially
      if (error.name === 'AbortError') {
        console.error('Tour fetch aborted due to timeout');
        setError('Request timed out. The server took too long to respond. Please try again later.');
      } else {
        console.error('Error fetching tour:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
      // Ensure timeout is cleared in all cases
      clearTimeout(timeoutId);
    }
  }, [tourId]);
  
  // Also memoize this function
  const fetchExistingAudioGuides = useCallback(async (tourPois: any[]) => {
    console.log('Checking for existing audio guides...');
    
    try {
      // Check if pois exist in the tour
      if (!tourPois || tourPois.length === 0) {
        console.log('No POIs found in the tour, cannot fetch audio guides');
        return;
      }
      
      // Map POIs to their IDs for the API call
      const poiIds = tourPois.map(tourPoi => tourPoi.poi.id || `poi-${tourPoi.sequence_number}`);
      console.log('POI IDs to check for audio:', poiIds);
      
      // Call an API endpoint to get existing audio guides
      const response = await fetch('/api/audio-guide/fetch-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ poiIds }),
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch existing audio guides: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.audioGuides) {
        console.log('Found existing audio guides:', data.audioGuides);
        // Update the audio data state with existing guides
        setAudioData(data.audioGuides);
      }
    } catch (error) {
      console.error('Error fetching existing audio guides:', error);
    }
  }, []);
  
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
  
  // Add this function to format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Update the playAudio function with URL refresh capability
  const playAudio = useCallback(async (url: string, label: string) => {
    console.log(`Attempting to play audio: ${label} from URL: ${url}`);
    
    if (!url) {
      console.error(`No URL provided for ${label} audio`);
      alert(`Error: No audio URL available for ${label}`);
      setIsAudioLoading(false);
      return;
    }
    
    try {
      // Show the transcript for this audio
      setShowTranscript(true);
      
      // Display spinner or loading state first
      setIsAudioLoading(true);
      setCurrentAudioId(label === "Brief Overview" ? 'brief' : label === "Detailed Guide" ? 'detailed' : 'in-depth');
      setActiveAudioUrl(url);
      
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
        audioElement.removeAttribute('src'); // Better than setting to empty string
        audioElement.load();
      }
      
      // Create a new audio element with proper event handling sequence
      const audio = new Audio();
      
      // Debug the URL
      console.log(`Full audio URL: ${url}`);
      
      // Check for URL token expiry
      if (url.includes('?')) {
        const expiryMatch = url.match(/expires=(\d+)/i);
        if (expiryMatch && expiryMatch[1]) {
          const expiryTimestamp = parseInt(expiryMatch[1]);
          const currentTime = Math.floor(Date.now() / 1000);
          const timeLeft = expiryTimestamp - currentTime;
          
          // If URL is expired or about to expire (less than 5 minutes left)
          if (timeLeft <= 300) {
            console.log('Signed URL is expired or about to expire. Refreshing audio URLs...');
            
            // Get the current POI ID and audio type
            const currentPoiId = currentStop?.poi?.id || `poi-${currentStopIndex}`;
            const audioType = label === "Brief Overview" ? 'brief' : 
                            label === "Detailed Guide" ? 'detailed' : 'in-depth';
            
            try {
              // Fetch fresh audio URLs for the current POI
              const refreshResponse = await fetch('/api/audio-guide/fetch-existing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poiIds: [currentPoiId] })
              });
              
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.success && refreshData.audioGuides && refreshData.audioGuides[currentPoiId]) {
                  // Update audioData state with fresh URLs
                  const freshAudioData = refreshData.audioGuides[currentPoiId];
                  
                  setAudioData(prevData => ({
                    ...prevData,
                    [currentPoiId]: freshAudioData
                  }));
                  
                  // Get the fresh URL based on audio type
                  let freshUrl;
                  if (audioType === 'brief') {
                    freshUrl = freshAudioData.audioFiles.coreAudioUrl;
                  } else if (audioType === 'detailed') {
                    freshUrl = freshAudioData.audioFiles.secondaryAudioUrl;
                  } else {
                    freshUrl = freshAudioData.audioFiles.tertiaryAudioUrl;
                  }
                  
                  if (freshUrl) {
                    console.log(`Using fresh URL for ${label} audio`);
                    url = freshUrl;
                    setActiveAudioUrl(freshUrl);
                  }
                }
              }
            } catch (refreshError) {
              console.error('Error refreshing audio URL:', refreshError);
              // Continue with existing URL as fallback
            }
          }
        }
      }
      
      // Set up error handling first
      audio.addEventListener('error', (e) => {
        console.error(`Audio error for ${label}:`, e);
        console.error('Audio error details:', audio.error);
        
        // Only show alert for permanent errors, not transitional ones
        if (audio.error && audio.error.code !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          const errorMessages: Record<number, string> = {
            [MediaError.MEDIA_ERR_ABORTED]: "Playback aborted by the user",
            [MediaError.MEDIA_ERR_NETWORK]: "Network error while loading the audio",
            [MediaError.MEDIA_ERR_DECODE]: "Error decoding the audio file",
            [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: "Audio format not supported or CORS error"
          };
          
          const errorMessage = errorMessages[audio.error.code] || "Unknown error";
          
          console.warn(`Audio error: ${errorMessage}. Trying with download approach...`);
        }
        
        setIsAudioLoading(false);
        setIsPlaying(false);
      });
      
      // Add a timeout to prevent hanging in loading state
      const loadingTimeout = setTimeout(() => {
        if (isAudioLoading) {
          console.log('Audio loading timeout - resetting loading state');
          setIsAudioLoading(false);
        }
      }, 10000); // 10 second timeout
      
      // Set up metadata and playback events
      audio.addEventListener('loadedmetadata', () => {
        console.log(`Audio metadata loaded for ${label}, duration: ${audio.duration}`);
        setDuration(audio.duration);
        clearTimeout(loadingTimeout);
      });
      
      audio.addEventListener('canplaythrough', () => {
        console.log(`Audio can play through: ${label}`);
        setIsAudioLoading(false);
        clearTimeout(loadingTimeout);
        
        // Auto-play when ready
        audio.play().catch(error => {
          console.error(`Failed to auto-play audio ${label}:`, error);
          
          // For user interaction requirement errors, don't show alert
          if (error.name !== 'NotAllowedError') {
            alert(`Could not play audio: ${error.message}`);
          }
        });
        
        setIsPlaying(true);
      });
      
      // Modify the timeupdate event to use throttling
      audio.addEventListener('timeupdate', () => {
        // Always update the ref in real-time (no re-render)
        currentTimeRef.current = audio.currentTime;
        
        // Only update the state (causing re-render) at throttled intervals
        const now = Date.now();
        if (now - lastTimeUpdateRef.current > TIME_UPDATE_THROTTLE) {
          setCurrentTime(audio.currentTime);
          lastTimeUpdateRef.current = now;
        }
      });
      
      audio.addEventListener('playing', () => {
        console.log(`Audio started playing: ${label}`);
        setIsAudioLoading(false);
        setIsPlaying(true);
        clearTimeout(loadingTimeout);
      });
      
      audio.addEventListener('pause', () => {
        console.log(`Audio paused: ${label}`);
        setIsPlaying(false);
      });
      
      audio.addEventListener('ended', () => {
        console.log(`Audio ended: ${label}`);
        setIsPlaying(false);
        setCurrentTime(0);
      });
      
      // Now set the source and load - AFTER setting up all event handlers
      audio.crossOrigin = "anonymous"; // Add CORS handling
      audio.preload = 'auto';
      
      // Set audio properties
      audio.src = url;
      
      console.log("Loading audio file...");
      audio.load();
      
      // Store the audio element
      setAudioElement(audio);
      
    } catch (error) {
      console.error(`Error creating Audio object for ${label}:`, error);
      setIsAudioLoading(false);
      setIsPlaying(false);
      alert(`Error setting up audio playback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [audioElement, isAudioLoading, currentStop, currentStopIndex, setAudioData]);
  
  // Make these control functions memoized callbacks
  const togglePlayPause = useCallback(() => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play().catch(error => {
        console.error('Error playing audio:', error);
        alert(`Could not play audio: ${error.message}`);
      });
    }
  }, [audioElement, isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioElement) {
      audioElement.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [audioElement]);
  
  // Fix currentStop declaration position
  // This will ensure currentStop is defined before it's used in useEffect
  const currentStop = tour && tour.tourPois ? 
    [...tour.tourPois].sort((a, b) => a.sequence_number - b.sequence_number)[currentStopIndex] : 
    null;

  // Audio check - must come after currentStop is defined
  useEffect(() => {
    // Check if currentStop and audioData exist
    if (tour && currentStopIndex >= 0 && currentStopIndex < tour.tourPois.length && Object.keys(audioData).length > 0) {
      const poiId = tour.tourPois[currentStopIndex].poi.id || `poi-${currentStopIndex}`;
      const audioForCurrentStop = audioData[poiId];
      
      console.log("Current stop:", tour.tourPois[currentStopIndex]);
      console.log("Audio data available:", Object.keys(audioData));
      console.log("Audio for current POI:", audioForCurrentStop);
      
      // Check if we need to fetch audio data for this POI
      if (!audioForCurrentStop) {
        console.log("No audio data for current POI, fetching from database...");
        // We could fetch audio data here if necessary
      }
    }
  }, [tour, currentStopIndex, audioData]);
  
  useEffect(() => {
    if (currentStop && audioData) {
      const poiId = currentStop.poi.id || `poi-${currentStopIndex}`;
      console.log("Current POI ID:", poiId);
      console.log("Available audio data keys:", Object.keys(audioData));
      console.log("Has audio for current POI:", !!audioData[poiId]);
      if (audioData[poiId]) {
        console.log("Audio URLs:", audioData[poiId].audioFiles);
      }
    }
  }, [currentStop, currentStopIndex, audioData]);
  
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-6 my-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Tour</h1>
          <p className="mb-4">{error || 'Tour not found'}</p>
          <div className="flex space-x-4">
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Go Back Home
            </Link>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Sort tour POIs by sequence number
  const sortedPois = [...tour.tourPois].sort((a, b) => a.sequence_number - b.sequence_number);
  
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
              
              {/* Add website link if available */}
              {currentStop.poi.website && (
                <div className="mt-2">
                  <a 
                    href={currentStop.poi.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Visit Website
                  </a>
                </div>
              )}
              
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
              
              {/* Enhanced Audio Player Section */}
              {Object.keys(audioData).length > 0 ? (
                <>
                  {audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`] ? (
                    <div className="bg-gray-100 p-4 rounded-lg mb-4">
                      <div className="flex flex-col space-y-4">
                        {/* Audio selection buttons */}
                        <div className="flex flex-wrap gap-2">
                          <button 
                            className={`${currentAudioId === 'brief' ? 'bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 px-3 rounded flex items-center justify-center ${isAudioLoading && currentAudioId === 'brief' ? 'opacity-75 cursor-wait' : ''}`}
                            onClick={async () => {
                              setCurrentAudioId('brief');
                              const audioUrl = audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.audioFiles?.coreAudioUrl;
                              console.log("Brief audio URL:", audioUrl);
                              if (!audioUrl) {
                                alert("No brief audio available. Try regenerating the audio guides.");
                                return;
                              }
                              await playAudio(audioUrl, "Brief Overview");
                            }}
                            disabled={isAudioLoading}
                          >
                            {isAudioLoading && currentAudioId === 'brief' ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                </svg>
                                Brief Overview (30-60s)
                              </>
                            )}
                          </button>
                          
                          <button 
                            className={`${currentAudioId === 'detailed' ? 'bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 px-3 rounded flex items-center justify-center ${isAudioLoading && currentAudioId === 'detailed' ? 'opacity-75 cursor-wait' : ''}`}
                            onClick={async () => {
                              setCurrentAudioId('detailed');
                              const audioUrl = audioData[currentStop.poi.id || `poi-${currentStopIndex}`]?.audioFiles?.secondaryAudioUrl;
                              console.log("Detailed audio URL:", audioUrl);
                              if (!audioUrl) {
                                alert("No detailed audio available. Try regenerating the audio guides.");
                                return;
                              }
                              await playAudio(audioUrl, "Detailed Guide");
                            }}
                            disabled={isAudioLoading}
                          >
                            {isAudioLoading && currentAudioId === 'detailed' ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                </svg>
                                Detailed Guide (1-2 min)
                              </>
                            )}
                          </button>
                          
                          <button 
                            className={`${currentAudioId === 'in-depth' ? 'bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 px-3 rounded flex items-center justify-center ${isAudioLoading && currentAudioId === 'in-depth' ? 'opacity-75 cursor-wait' : ''}`}
                            onClick={async () => {
                              setCurrentAudioId('in-depth');
                              const audioUrl = audioData[currentStop.poi.id || `poi-${currentStopIndex}`]?.audioFiles?.tertiaryAudioUrl;
                              console.log("In-depth audio URL:", audioUrl);
                              if (!audioUrl) {
                                alert("No in-depth audio available. Try regenerating the audio guides.");
                                return;
                              }
                              await playAudio(audioUrl, "In-Depth Exploration");
                            }}
                            disabled={isAudioLoading}
                          >
                            {isAudioLoading && currentAudioId === 'in-depth' ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                </svg>
                                In-Depth Exploration (3+ min)
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Audio player controls */}
                        {activeAudioUrl && (
                          <div className="mt-4 bg-white p-3 rounded-lg shadow-sm">
                            {/* Play/Pause button and time indicator */}
                            <div className="flex items-center justify-between mb-2">
                              <button 
                                onClick={togglePlayPause} 
                                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full"
                                disabled={isAudioLoading}
                              >
                                {isAudioLoading ? (
                                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : isPlaying ? (
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                              <div className="text-sm font-medium text-gray-700">
                                {formatTime(currentTime)} / {formatTime(duration)}
                              </div>
                            </div>
                            
                            {/* Scrubber (progress bar) */}
                            <div className="w-full mb-3">
                              <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                disabled={!duration || isAudioLoading}
                              />
                            </div>
                            
                            {/* Transcript toggle button */}
                            <div className="flex justify-end">
                              <button
                                onClick={() => setShowTranscript(!showTranscript)}
                                className="text-xs flex items-center text-blue-600 hover:text-blue-800"
                              >
                                {showTranscript ? (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                    Hide Transcript
                                  </>
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Show Transcript
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
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
                </>
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
                href={getGoogleMapsUrl(currentStop.poi)}
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
        
        {/* Transcript display */}
        {showTranscript && currentAudioId && activeAudioUrl && audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.content && (
          <div className="mt-4 bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-900">Transcript</h4>
              <span className="text-xs text-gray-500">
                {currentAudioId === 'brief' ? 'Brief Overview' : 
                 currentAudioId === 'detailed' ? 'Detailed Guide' : 
                 'In-Depth Exploration'}
              </span>
            </div>
            <div className="prose prose-sm max-h-60 overflow-y-auto text-gray-600">
              {currentAudioId === 'brief' && (
                <p>{audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.content?.brief || 'No transcript available.'}</p>
              )}
              {currentAudioId === 'detailed' && (
                <p>{audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.content?.detailed || 'No transcript available.'}</p>
              )}
              {currentAudioId === 'in-depth' && (
                <p>{audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.content?.complete || 'No transcript available.'}</p>
              )}
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