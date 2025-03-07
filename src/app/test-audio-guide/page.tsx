'use client';

import React, { useState, useEffect } from 'react';
import { dataCollectionService } from '@/services/audioGuide';
import { PoiData, AudioGuideContent, AudioFiles } from '@/services/audioGuide';
import { createClient } from '@/utils/supabase/client';

// Initialize the singleton Supabase client only when actually needed
// This avoids potential module resolution issues
const getSupabaseClient = () => {
  return createClient();
};

// Helper function to get session
const getSession = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data.session;
};

export default function TestAudioGuide() {
  const [loading, setLoading] = useState<boolean>(false);
  const [poiName, setPoiName] = useState<string>('');
  const [poiData, setPoiData] = useState<PoiData | null>(null);
  const [contentData, setContentData] = useState<AudioGuideContent | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFiles | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'collect' | 'generate' | 'convert'>('collect');
  const [processingStep, setProcessingStep] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<string>('Checking...');

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getSession();
        setAuthStatus(session ? 'Authenticated' : 'Not authenticated (authentication temporarily disabled for testing)');
      } catch (error) {
        setAuthStatus('Error checking authentication');
        console.error('Auth check error:', error);
      }
    };
    
    checkAuth();
  }, []);

  // Sample POI with location
  const samplePois = [
    {
      id: "eiffel-tower",
      name: "Eiffel Tower",
      place_id: "ChIJLU7jZClu5kcR4PcOOO6p3I0",
      location: { lat: 48.8584, lng: 2.2945 },
      formatted_address: "Champ de Mars, 5 Av. Anatole France, 75007 Paris, France",
      types: ["tourist_attraction", "point_of_interest"]
    },
    {
      id: "statue-of-liberty",
      name: "Statue of Liberty",
      place_id: "ChIJPTacEpBQwokRKwIlDXelxkA",
      location: { lat: 40.6892, lng: -74.0445 },
      formatted_address: "New York, NY 10004, United States",
      types: ["tourist_attraction", "point_of_interest"]
    },
    {
      id: "colosseum",
      name: "Colosseum",
      place_id: "ChIJrRMgU7ZhLxMRxAOFkujgNEw",
      location: { lat: 41.8902, lng: 12.4922 },
      formatted_address: "Piazza del Colosseo, 1, 00184 Roma RM, Italy",
      types: ["tourist_attraction", "point_of_interest"]
    }
  ];

  // Available voice options
  const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const [selectedVoice, setSelectedVoice] = useState<string>('nova');

  const handleCollectData = async (poi: any) => {
    setError(null);
    setLoading(true);
    setProcessingStep('Collecting data from Wikipedia and Wikivoyage...');
    setPoiName(poi.name);
    try {
      const data = await dataCollectionService.collectPoiData(poi);
      setPoiData(data);
      setStep('generate');
    } catch (err: any) {
      setError(`Error collecting data: ${err.message}`);
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  const handleGenerateContent = async () => {
    if (!poiData) return;
    setError(null);
    setLoading(true);
    setProcessingStep('Generating content with AI...');
    
    try {
      // Call the server-side API for content generation
      const response = await fetch('/api/content-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ poiData }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }
      
      const data = await response.json();
      setContentData(data.content);
      setStep('convert');
    } catch (err: any) {
      setError(`Error generating content: ${err.message}`);
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  const handleTextToSpeech = async () => {
    if (!contentData || !poiData) return;
    setError(null);
    setLoading(true);
    setProcessingStep('Converting text to speech and uploading audio files...');
    
    try {
      // The POI from our samples has an ID
      const poiId = samplePois.find(p => p.name === poiName)?.id || 'test-poi';
      
      // Call the server-side API for text-to-speech
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentData,
          poiId,
          voice: selectedVoice
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details 
            ? `${errorData.error}: ${errorData.details}` 
            : errorData.error || 'Error converting to speech'
        );
      }
      
      const data = await response.json();
      setAudioFiles(data.audioFiles);
      setStep('convert');
    } catch (error: any) {
      console.error('Text-to-speech error:', error);
      setError(error.message || 'Failed to convert text to speech');
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  const renderAudioPlayer = (url: string, title: string) => {
    return (
      <div className="mb-4">
        <h3 className="font-bold mb-2">{title}</h3>
        <audio controls className="w-full">
          <source src={url} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Audio Guide Test Page</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
        <p className="text-blue-800">
          <strong>Auth Status:</strong> {authStatus}
        </p>
        <p className="text-blue-800 text-sm mt-1">
          API authentication requirements have been temporarily disabled for testing purposes.
        </p>
      </div>

      {/* Supabase storage notice */}
      <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
        <p className="text-green-800">
          <strong>Supabase Storage:</strong> The app is now using real Supabase storage.
        </p>
        <p className="text-green-800 text-sm mt-1">
          Ensure your Supabase project is configured with:
          <ul className="list-disc ml-5 mt-1">
            <li>Storage enabled</li>
            <li>An 'audio-guides' bucket with public access</li>
            <li>CORS configured for http://localhost:3000</li>
          </ul>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800"><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      {loading && processingStep && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <svg className="animate-spin h-5 w-5 mr-3 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{processingStep}</span>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Step 1: Collect Data for POI</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {samplePois.map((poi, index) => (
            <div 
              key={index} 
              className="border p-4 rounded cursor-pointer hover:bg-gray-100"
              onClick={() => handleCollectData(poi)}
            >
              <h3 className="font-bold">{poi.name}</h3>
              <p className="text-sm">{poi.formatted_address}</p>
            </div>
          ))}
        </div>
      </div>
      
      {poiData && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Data Collected for {poiName}</h2>
          <div className="border p-4 rounded bg-gray-50">
            <h3 className="font-bold mb-2">Data Quality:</h3>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(dataCollectionService.analyzePoiData(poiData), null, 2)}
            </pre>
            
            {poiData.wikipedia && (
              <div className="mt-4">
                <h3 className="font-bold">Wikipedia Data:</h3>
                <p><strong>Title:</strong> {poiData.wikipedia.title}</p>
                <p className="mt-1"><strong>Extract:</strong></p>
                <p className="text-sm">{poiData.wikipedia.extract.substring(0, 200)}...</p>
              </div>
            )}
            
            {poiData.wikivoyage && (
              <div className="mt-4">
                <h3 className="font-bold">Wikivoyage Data:</h3>
                <p><strong>Title:</strong> {poiData.wikivoyage.title}</p>
                {poiData.wikivoyage.seeSection && (
                  <>
                    <p className="mt-1"><strong>See Section:</strong></p>
                    <p className="text-sm">{poiData.wikivoyage.seeSection.substring(0, 200)}...</p>
                  </>
                )}
              </div>
            )}
            
            {step === 'generate' && (
              <button
                onClick={handleGenerateContent}
                disabled={loading}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {loading ? 'Generating...' : 'Generate Audio Content'}
              </button>
            )}
          </div>
        </div>
      )}
      
      {contentData && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Generated Content</h2>
          <div className="border p-4 rounded bg-gray-50">
            <div className="mb-4">
              <h3 className="font-bold">Core Content (30-60 seconds):</h3>
              <p className="whitespace-pre-wrap">{contentData.core}</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-bold">Secondary Content (1-2 minutes):</h3>
              <p className="whitespace-pre-wrap">{contentData.secondary}</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-bold">Tertiary Content (3+ minutes):</h3>
              <p className="whitespace-pre-wrap">{contentData.tertiary}</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-bold">Credits:</h3>
              <p className="whitespace-pre-wrap">{contentData.credits}</p>
            </div>
            
            {step === 'convert' && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center mb-4">
                  <label className="mr-4 font-semibold">Select Voice:</label>
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="border rounded px-2 py-1"
                    disabled={loading}
                  >
                    {voices.map(voice => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={handleTextToSpeech}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                  {loading ? 'Converting to Speech...' : 'Convert to Speech'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {audioFiles && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Audio Guide Files</h2>
          <div className="border p-4 rounded bg-gray-50">
            {renderAudioPlayer(audioFiles.coreAudioUrl, "Core Audio (30-60 seconds)")}
            {renderAudioPlayer(audioFiles.secondaryAudioUrl, "Secondary Audio (1-2 minutes)")}
            {renderAudioPlayer(audioFiles.tertiaryAudioUrl, "Tertiary Audio (3+ minutes)")}
            
            <div className="mt-4 text-sm text-gray-600">
              <p>These audio files are stored in Supabase Storage. In a real application, the URLs would be saved in the database for future reference.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 