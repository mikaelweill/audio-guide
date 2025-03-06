'use client';

import { useState } from 'react';
import { dataCollectionService } from '@/services/audioGuide';

type AudioGuideControlsProps = {
  tour: any;
};

export default function AudioGuideControls({ tour }: AudioGuideControlsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [audioData, setAudioData] = useState<Record<string, any>>({});
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  // Function to generate audio guides for all POIs in the tour
  const handleGenerateAudioGuides = async () => {
    if (!tour || !tour.route || tour.route.length === 0) {
      alert('No POIs found in this tour');
      return;
    }

    setIsGenerating(true);
    setCurrentStep('Starting audio guide generation...');
    setProgress(0);

    try {
      const audioResults: Record<string, any> = {};
      const totalPois = tour.route.length;

      // Process each POI in the tour
      for (let i = 0; i < totalPois; i++) {
        const poi = tour.route[i];
        const progressPercent = Math.round((i / totalPois) * 100);
        setProgress(progressPercent);
        
        setCurrentStep(`Collecting data for ${poi.name} (${i + 1}/${totalPois})...`);
        
        // 1. Collect data from sources
        const poiData = await dataCollectionService.collectPoiData({
          name: poi.name,
          formatted_address: poi.vicinity || poi.formatted_address || '',
          location: poi.geometry?.location || null,
          types: poi.types || [],
          rating: poi.rating,
          photo_references: poi.photos?.map((p: any) => p.photo_reference) || []
        });

        setCurrentStep(`Generating content for ${poi.name} (${i + 1}/${totalPois})...`);
        
        // 2. Generate content using the server-side API
        const contentResponse = await fetch('/api/content-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ poiData }),
        });

        if (!contentResponse.ok) {
          throw new Error(`Failed to generate content for ${poi.name}`);
        }

        const contentData = await contentResponse.json();
        
        setCurrentStep(`Converting to speech for ${poi.name} (${i + 1}/${totalPois})...`);
        
        // 3. Convert to speech using the server-side API
        const ttsResponse = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: contentData.content,
            poiId: poi.place_id || `poi-${tour.route.indexOf(poi)}`,
            voice: 'nova', // Default voice
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`Failed to convert text to speech for ${poi.name}`);
        }

        const audioFiles = await ttsResponse.json();
        
        // Store the results
        audioResults[poi.place_id || `poi-${tour.route.indexOf(poi)}`] = {
          name: poi.name,
          content: contentData.content,
          audioFiles: audioFiles.audioFiles,
        };
      }

      setAudioData(audioResults);
      setCurrentStep('');
      setProgress(100);
      
      alert(`Generated audio guides for ${tour.route.length} POIs`);
    } catch (error) {
      console.error('Error generating audio guides:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate audio guides');
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to open transcript modal
  const handleViewTranscript = (poiId: string) => {
    setSelectedPoiId(poiId);
    setIsModalOpen(true);
  };

  return (
    <div>
      {Object.keys(audioData).length === 0 ? (
        // Main generation button when no audio is generated yet
        <button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md font-semibold text-lg flex items-center justify-center"
          onClick={handleGenerateAudioGuides}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Audio Guides...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
              </svg>
              Generate Audio Guides for All Locations
            </>
          )}
        </button>
      ) : (
        // Audio player controls when audio is generated
        <div className="mt-2">
          <h3 className="text-lg font-semibold mb-3">Available Audio Guides</h3>
          <div className="space-y-4">
            {tour.route.map((poi: any, index: number) => {
              const poiId = poi.place_id || `poi-${index}`;
              const poiAudio = audioData[poiId];
              
              if (!poiAudio) return null;
              
              return (
                <div 
                  key={poiId} 
                  className="p-4 border border-gray-200 rounded-md bg-white shadow-sm"
                >
                  <h4 className="font-bold mb-2">{poi.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm flex items-center"
                      onClick={() => {
                        const audio = new Audio(poiAudio.audioFiles.coreAudioUrl);
                        audio.play();
                      }}
                    >
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                      </svg>
                      Brief (30-60s)
                    </button>
                    <button 
                      className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm flex items-center"
                      onClick={() => {
                        const audio = new Audio(poiAudio.audioFiles.secondaryAudioUrl);
                        audio.play();
                      }}
                    >
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                      </svg>
                      Detailed (1-2m)
                    </button>
                    <button 
                      className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded text-sm flex items-center"
                      onClick={() => {
                        const audio = new Audio(poiAudio.audioFiles.tertiaryAudioUrl);
                        audio.play();
                      }}
                    >
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                      </svg>
                      In-depth (3m+)
                    </button>
                    <button 
                      className="border border-gray-300 hover:bg-gray-100 px-3 py-1 rounded text-sm flex items-center"
                      onClick={() => handleViewTranscript(poiId)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
                      </svg>
                      Transcript
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <button 
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center"
            onClick={handleGenerateAudioGuides}
            disabled={isGenerating}
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"></path>
            </svg>
            Regenerate Audio Guides
          </button>
        </div>
      )}

      {/* Progress indicator during generation */}
      {isGenerating && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">{currentStep}</p>
        </div>
      )}

      {/* Transcript Modal */}
      {isModalOpen && selectedPoiId && audioData[selectedPoiId] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">
                Transcript: {audioData[selectedPoiId].name}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="p-6">
              <h4 className="font-bold mb-2">Brief Overview (30-60s)</h4>
              <p className="mb-4">{audioData[selectedPoiId].content.core}</p>
              
              <h4 className="font-bold mb-2">Detailed Information (1-2m)</h4>
              <p className="mb-4">{audioData[selectedPoiId].content.secondary}</p>
              
              <h4 className="font-bold mb-2">In-depth Context (3m+)</h4>
              <p className="mb-4">{audioData[selectedPoiId].content.tertiary}</p>
              
              <h4 className="font-bold mb-2">Sources</h4>
              <p className="whitespace-pre-line">{audioData[selectedPoiId].content.credits}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 