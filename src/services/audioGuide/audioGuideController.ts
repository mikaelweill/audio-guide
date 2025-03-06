/**
 * Audio Guide Controller
 * 
 * Orchestrates the entire process of generating and managing audio guides
 */

import dataCollectionService, { PoiData } from './dataCollectionService';
import contentGenerationService, { AudioGuideContent } from './contentGenerationService';
import ttsService, { AudioFiles, VoiceOption } from './ttsService';

/**
 * Result of the audio guide generation process
 */
export interface AudioGuideResult {
  poiId: string;
  poiName: string;
  audioFiles: AudioFiles;
  content: AudioGuideContent;
  sources: string[];
  qualityScore: number;
}

/**
 * Generate a complete audio guide for a POI
 */
export async function generateAudioGuideForPoi(
  poi: any,
  voice: VoiceOption = 'nova'
): Promise<AudioGuideResult> {
  try {
    // Step 1: Initialize storage if needed
    await ttsService.initializeAudioStorage();
    
    // Step 2: Collect data from all sources
    const poiData = await dataCollectionService.collectPoiData(poi);
    
    // Step 3: Analyze the collected data quality
    const analysis = dataCollectionService.analyzePoiData(poiData);
    
    // Step 4: Generate the content for all layers
    const content = await contentGenerationService.generateAudioGuideContent(poiData);
    
    // Step 5: Convert content to speech and store audio files
    const audioFiles = await ttsService.generateAndStoreAudio(content, poi.id, voice);
    
    // Step 6: Return the complete result
    return {
      poiId: poi.id,
      poiName: poi.name,
      audioFiles,
      content,
      sources: analysis.sources,
      qualityScore: analysis.quality === 'high' ? 3 : analysis.quality === 'medium' ? 2 : 1
    };
  } catch (error) {
    console.error('Error generating audio guide:', error);
    throw error;
  }
}

/**
 * Update or refresh the audio guide for a POI
 */
export async function refreshAudioGuide(
  poiId: string,
  poiData: PoiData,
  voice: VoiceOption = 'nova'
): Promise<AudioGuideResult> {
  try {
    // Generate new content based on the provided data
    const content = await contentGenerationService.generateAudioGuideContent(poiData);
    
    // Convert to speech and store
    const audioFiles = await ttsService.generateAndStoreAudio(content, poiId, voice);
    
    // Analyze data quality
    const analysis = dataCollectionService.analyzePoiData(poiData);
    
    return {
      poiId,
      poiName: poiData.basic.name,
      audioFiles,
      content,
      sources: analysis.sources,
      qualityScore: analysis.quality === 'high' ? 3 : analysis.quality === 'medium' ? 2 : 1
    };
  } catch (error) {
    console.error('Error refreshing audio guide:', error);
    throw error;
  }
}

export default {
  generateAudioGuideForPoi,
  refreshAudioGuide
}; 