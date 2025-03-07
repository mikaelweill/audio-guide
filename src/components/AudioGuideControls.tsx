'use client';

import { useState } from 'react';
import { dataCollectionService } from '@/services/audioGuide';
import { createClient } from '@/utils/supabase/client';

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

  // Function to fetch audio data for a POI from the database
  const fetchPoiAudioData = async (poiId: string) => {
    try {
      const response = await fetch(`/api/poi-audio/${poiId}`);
      if (!response.ok) {
        console.error(`Failed to fetch audio data for POI ${poiId}: ${response.statusText}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching audio data for POI ${poiId}:`, error);
      return null;
    }
  };

  // Function to generate audio guides for all POIs in the tour
  const handleGenerateAudioGuides = async () => {
    if (!tour || !tour.route || tour.route.length === 0) {
      alert('No POIs found in this tour');
      return;
    }

    setIsGenerating(true);
    setCurrentStep('Starting parallel audio guide generation...');
    setProgress(0);

    try {
      const audioResults: Record<string, any> = {};
      const totalPois = tour.route.length;
      
      // Initialize Supabase client
      const supabase = createClient();
      
      // Update UI to show we're processing all POIs at once
      setCurrentStep(`Processing all ${totalPois} POIs simultaneously using Supabase Edge Functions...`);
      
      // Create an array of processing functions for all POIs
      const poiProcessingPromises = tour.route.map(async (poi: any, index: number) => {
        try {
          // Update UI to show which POI is being processed
          console.log(`Processing POI ${index + 1}/${totalPois}: ${poi.name}`);
          
          // Determine POI ID
          const poiId = poi.place_id || `poi-${tour.route.indexOf(poi)}`;
          
          // First check if this POI already has audio guides in the database
          const { data: existingAudio, error } = await supabase
            .from('poi')
            .select('brief_audio_url, detailed_audio_url, complete_audio_url')
            .eq('id', poiId)
            .single();
          
          // If we already have all three audio files, skip processing
          if (existingAudio && 
              existingAudio.brief_audio_url && 
              existingAudio.detailed_audio_url && 
              existingAudio.complete_audio_url) {
            console.log(`POI ${poi.name} already has audio guides - skipping processing`);
            
            // Fetch the full audio data including transcripts
            const existingData = await fetchPoiAudioData(poiId);
            
            return {
              poiId: poiId,
              name: poi.name,
              skipped: true,
              existingData: existingData,
              success: true
            };
          }
          
          // 1. Collect data from sources
          const poiData = await dataCollectionService.collectPoiData({
            id: poiId,
            place_id: poiId,
            name: poi.name,
            formatted_address: poi.vicinity || poi.formatted_address || '',
            location: poi.geometry?.location || null,
            types: poi.types || [],
            rating: poi.rating,
            photo_references: poi.photos?.map((p: any) => p.photo_reference) || []
          });
          
          // 2. Call the Supabase Edge Function to process this POI
          const { data: authData } = await supabase.auth.getSession();
          const accessToken = authData.session?.access_token;
          
          const response = await fetch(
            'https://uzqollduvddowyzjvmzn.supabase.co/functions/v1/process-poi',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ poiData }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Function failed for ${poi.name}: ${response.status} ${errorText}`);
          }

          const result = await response.json();
          console.log(`Completed processing for ${poi.name}:`, result);
          
          return {
            poiId: poiId,
            name: poi.name,
            result: result,
            success: result.success || false,
            existingContent: result.existingContent || false
          };
        } catch (error) {
          console.error(`Error processing POI ${poi.name}:`, error);
          // Even if one POI fails, we continue with the others
          return {
            poiId: poi.place_id || `poi-${tour.route.indexOf(poi)}`,
            name: poi.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          };
        }
      });
      
      // Show that we're running in parallel mode
      setCurrentStep(`Processing ${totalPois} locations in parallel - this may take a few minutes...`);
      
      // Track completed POIs
      let completedCount = 0;
      
      // Process all POIs in parallel and update progress
      const results = await Promise.allSettled(poiProcessingPromises);
      
      // Process results as they complete
      const completedPois: string[] = [];
      const skippedPois: string[] = [];
      const failedPois: string[] = [];
      const successfulPoiIds: string[] = [];
      
      results.forEach((result) => {
        completedCount++;
        const progressPercent = Math.round((completedCount / totalPois) * 100);
        setProgress(progressPercent);
        
        if (result.status === 'fulfilled') {
          const poiResult = result.value;
          
          if (poiResult.success) {
            // If we used existing content or skipped, note that
            if (poiResult.existingContent || poiResult.skipped) {
              skippedPois.push(poiResult.name);
            } else {
              completedPois.push(poiResult.name);
            }
            
            successfulPoiIds.push(poiResult.poiId);
            
            // If we already have the data (skipped case), add it to audioResults
            if (poiResult.existingData) {
              audioResults[poiResult.poiId] = poiResult.existingData;
            } else if (poiResult.result) {
              // Format the data from the Edge Function to match what our UI expects
              audioResults[poiResult.poiId] = {
                name: poiResult.name,
                audioFiles: poiResult.result.audioFiles,
                content: poiResult.result.content
              };
            }
          } else {
            failedPois.push(poiResult.name);
          }
        }
      });
      
      // Update UI with summary of what happened
      if (failedPois.length > 0) {
        setCurrentStep(`Completed ${completedPois.length} new, ${skippedPois.length} existing, ${failedPois.length} failed out of ${totalPois} POIs.`);
      } else if (skippedPois.length > 0) {
        setCurrentStep(`Successfully processed ${completedPois.length} new locations and reused ${skippedPois.length} existing ones.`);
      } else {
        setCurrentStep(`Successfully processed all ${totalPois} POIs!`);
      }
      
      // Fetch any missing audio data for successful POIs
      const missingPoiIds = successfulPoiIds.filter(poiId => !audioResults[poiId]);
      
      if (missingPoiIds.length > 0) {
        setCurrentStep('Fetching remaining audio data from database...');
        
        const audioDataPromises = missingPoiIds.map(poiId => fetchPoiAudioData(poiId));
        const audioDataResults = await Promise.allSettled(audioDataPromises);
        
        // Process fetched audio data
        audioDataResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            const poiId = missingPoiIds[index];
            audioResults[poiId] = result.value;
          }
        });
      }

      console.log("Successful POI IDs:", successfulPoiIds);
      console.log("Final audioResults:", audioResults);
      
      setAudioData(audioResults);
      setProgress(100);
      setCurrentStep('');
      
      alert(`Generated audio guides for ${Object.keys(audioResults).length} of ${totalPois} POIs`);
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