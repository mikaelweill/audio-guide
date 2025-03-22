'use client';

import { useState, useRef, useEffect } from 'react';
import { dataCollectionService } from '@/services/audioGuide';
import { createClient } from '@/utils/supabase/client';
import { useTranscriptModal } from '@/context/TranscriptModalContext';
import { ensureCompleteAudioUrl } from '@/services/offlineTourService';

// Define the type for the POI audio data
interface PoiAudio {
  id: string;
  name: string;
  audioUrl: string;
  transcript?: string;
  language?: string;
  translationInProgress?: boolean;
}

type AudioGuideControlsProps = {
  tour: any;
};

export default function AudioGuideControls({ tour }: AudioGuideControlsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [audioData, setAudioData] = useState<Record<string, any>>({});
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPoiIndex, setCurrentPoiIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use the transcript modal context
  const { openModal } = useTranscriptModal();

  // Function to fetch audio data for a POI from the database
  const fetchPoiAudioData = async (poiId: string) => {
    try {
      const response = await fetch(`/api/poi-audio/${poiId}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: Failed to fetch audio data`);
      }
      const data = await response.json();
      if (data && data.audioUrl) {
        // Ensure we have a complete URL for the audio
        const updatedData = {
          ...data,
          audioUrl: ensureCompleteAudioUrl(data.audioUrl)
        };
        
        setAudioData((prev) => ({
          ...prev,
          [poiId]: updatedData,
        }));
      }
    } catch (error) {
      console.error('Error fetching POI audio data:', error);
    }
  };

  // Function to handle generating audio guides for the tour
  const handleGenerateAudioGuides = async () => {
    if (!tour || !tour.poiIds || tour.poiIds.length === 0) {
      console.error('No POIs found in tour data');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      // Calculate progress increment per POI
      const progressIncrement = 100 / tour.poiIds.length;
      
      // Process each POI sequentially
      for (let i = 0; i < tour.poiIds.length; i++) {
        const poiId = tour.poiIds[i];
        const poiName = tour.poiNames?.[i] || `POI ${i + 1}`;
        
        // Update progress state
        setCurrentStep(`Generating audio for "${poiName}"`);
        
        // Check if audio already exists
        const response = await fetch(`/api/poi-audio/${poiId}`);
        const data = await response.json();
        
        if (data && data.audioUrl) {
          console.log(`Audio already exists for POI: ${poiName}`);
          // Just update the audio data state with complete URL
          const updatedData = {
            ...data,
            audioUrl: ensureCompleteAudioUrl(data.audioUrl)
          };
          
          setAudioData((prev) => ({
            ...prev,
            [poiId]: updatedData,
          }));
        } else {
          // Generate audio for this POI using the data collection service
          const poiAudioData = await dataCollectionService.generateAudioGuide(poiId);
          
          // Save the generated audio data to state with complete URL
          if (poiAudioData) {
            const updatedAudioData = {
              ...poiAudioData,
              audioUrl: ensureCompleteAudioUrl(poiAudioData.audioUrl)
            };
            
            setAudioData((prev) => ({
              ...prev,
              [poiId]: updatedAudioData,
            }));
          }
        }
        
        // Update progress
        setProgress((i + 1) * progressIncrement);
      }
      
      // Set final progress state
      setCurrentStep('All audio guides generated successfully!');
      setProgress(100);
    } catch (error) {
      console.error('Error generating audio guides:', error);
      setCurrentStep(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Reset generating state after a delay
      setTimeout(() => {
      setIsGenerating(false);
      }, 1500);
    }
  };

  // Load all audio data when tour is loaded
  useEffect(() => {
    if (tour && tour.poiIds && tour.poiIds.length > 0) {
      // Check if we already have audio data for all POIs
      const missingPoiIds = tour.poiIds.filter(
        (poiId: string) => !audioData[poiId]
      );
      
      // If we're missing audio data, fetch it
      if (missingPoiIds.length > 0) {
        missingPoiIds.forEach((poiId: string) => {
          fetchPoiAudioData(poiId);
        });
      }
    }
  }, [tour]);

  // Handle play/pause toggle for audio playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
      });
      setIsPlaying(true);
    }
  };

  // Navigate to the previous POI
  const handlePrevious = () => {
    if (currentPoiIndex > 0) {
      setCurrentPoiIndex(currentPoiIndex - 1);
      setSelectedPoiId(tour.poiIds[currentPoiIndex - 1]);
    }
  };

  // Navigate to the next POI
  const handleNext = () => {
    if (currentPoiIndex < tour.poiIds.length - 1) {
      setCurrentPoiIndex(currentPoiIndex + 1);
      setSelectedPoiId(tour.poiIds[currentPoiIndex + 1]);
    }
  };

  // Update audio player when selectedPoiId changes
  useEffect(() => {
    if (selectedPoiId && audioData[selectedPoiId]) {
      // Reset audio player
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioData[selectedPoiId].audioUrl;
        audioRef.current.load();
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
      }
    }
  }, [selectedPoiId, audioData]);

  // Set up audio element event listeners
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      
      // Auto-advance to next POI when audio ends
      if (currentPoiIndex < tour.poiIds.length - 1) {
        setCurrentPoiIndex(currentPoiIndex + 1);
        setSelectedPoiId(tour.poiIds[currentPoiIndex + 1]);
      }
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [currentPoiIndex, tour.poiIds]);

  // Handle seeking in the progress bar
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const seekPercentage = clickPosition / rect.width;
    const seekTime = seekPercentage * duration;
    
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Handle opening the transcript modal
  const handleViewTranscript = (poiId: string) => {
    if (audioData[poiId]?.transcript) {
      const poiName = tour.poiNames[tour.poiIds.indexOf(poiId)] || "POI";
      openModal(
        audioData[poiId].transcript,
        poiName,
        audioData[poiId].language,
        audioData[poiId].translationInProgress
      );
    }
  };

  // Format duration for display (MM:SS)
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // If no tour data is available, render nothing
  if (!tour || !tour.poiIds || tour.poiIds.length === 0) {
    return null;
  }

  // Convert audioData to array format for rendering
  const poiAudios: PoiAudio[] = tour.poiIds.map((poiId: string, index: number) => {
    const poiName = tour.poiNames?.[index] || `POI ${index + 1}`;
    const poiAudioData = audioData[poiId] || {};
    
    return {
      id: poiId,
      name: poiName,
      audioUrl: poiAudioData.audioUrl || '',
      transcript: poiAudioData.transcript || '',
      language: poiAudioData.language || 'English',
      translationInProgress: poiAudioData.translationInProgress || false
    };
  });

  return (
    <>
      {/* Audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
      
      {/* Generate audio button - only shown if audio is missing */}
      {tour.poiIds.some((poiId: string) => !audioData[poiId]?.audioUrl) && (
        <div className="fixed bottom-24 left-0 right-0 z-50 flex justify-center">
        <button 
          onClick={handleGenerateAudioGuides}
          disabled={isGenerating}
            className={`px-4 py-2 rounded-lg flex items-center justify-center 
              ${isGenerating ? 'bg-gray-700 text-gray-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
              shadow-lg transition-colors duration-300`}
        >
          {isGenerating ? (
            <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
                {currentStep} ({Math.round(progress)}%)
            </>
          ) : (
            <>
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
                Generate Audio Guides
            </>
          )}
        </button>
        </div>
      )}
      
      {/* Audio control UI */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800/95 backdrop-blur-md border-t border-slate-700">
        <div className="max-w-screen-md mx-auto px-4 py-4">
          {/* POI selector */}
          <div className="flex mb-4 overflow-x-auto scrollbar-hide gap-2 pb-2">
            {poiAudios.map((poiAudio, index) => (
                    <button 
                key={poiAudio.id}
                      onClick={() => {
                  setSelectedPoiId(poiAudio.id);
                  setCurrentPoiIndex(index);
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
                  ${selectedPoiId === poiAudio.id || (index === currentPoiIndex && !selectedPoiId)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}
                  transition-colors duration-200`}
              >
                {poiAudio.name}
                {poiAudio.translationInProgress && (
                  <span className="ml-1 inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                )}
                    </button>
            ))}
          </div>
          
          {/* Current POI info */}
          {(selectedPoiId || currentPoiIndex < tour.poiIds.length) && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <h3 className="text-lg font-medium text-white">
                    {poiAudios[currentPoiIndex]?.name || "Select a POI"}
                  </h3>
                  {poiAudios[currentPoiIndex]?.language && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-900/50 rounded-full text-indigo-400 text-xs">
                      {poiAudios[currentPoiIndex].language}
                    </span>
                  )}
                  {poiAudios[currentPoiIndex]?.translationInProgress && (
                    <span className="ml-2 flex items-center space-x-1 px-2 py-0.5 bg-amber-900/30 rounded-full text-amber-400 text-xs">
                      <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Translating...
                    </span>
                  )}
          </div>
          
                {poiAudios[currentPoiIndex]?.transcript && (
          <button 
                    onClick={() => handleViewTranscript(poiAudios[currentPoiIndex].id)}
                    className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center"
          >
                    View Transcript
                    <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
                )}
        </div>
              
              {/* Audio progress bar */}
              <div 
                onClick={handleSeek}
                className="h-2 bg-slate-700 rounded-full cursor-pointer overflow-hidden"
              >
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
          </div>
              
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
        </div>
      )}

          {/* Playback controls */}
          <div className="flex items-center justify-between">
            {/* Left controls - Previous button */}
            <button
              onClick={handlePrevious}
              disabled={currentPoiIndex === 0}
              className={`p-2 rounded-full focus:outline-none
                ${currentPoiIndex === 0 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Center - Play button */}
              <button 
              onClick={togglePlay}
              disabled={!poiAudios[currentPoiIndex]?.audioUrl}
              className={`p-4 rounded-full focus:outline-none
                ${!poiAudios[currentPoiIndex]?.audioUrl 
                  ? 'bg-gray-700 text-gray-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              </button>
            
            {/* Right controls - Next button */}
            <button
              onClick={handleNext}
              disabled={currentPoiIndex === tour.poiIds.length - 1}
              className={`p-2 rounded-full focus:outline-none
                ${currentPoiIndex === tour.poiIds.length - 1 
                  ? 'text-gray-600' 
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
    </div>
    </>
  );
} 