/**
 * Audio Guide Services Index
 * 
 * Central export point for all audio guide related services
 */

import wikipediaService from './wikipediaService';
import wikivoyageService from './wikivoyageService';
import dataCollectionService, { PoiData } from './dataCollectionService';
import contentGenerationService, { AudioGuideContent } from './contentGenerationService';
import ttsService, { AudioFiles, VoiceOption } from './ttsService';
import audioGuideController, { AudioGuideResult } from './audioGuideController';

// Export all types
export type {
  PoiData,
  AudioGuideContent,
  AudioFiles,
  VoiceOption,
  AudioGuideResult
};

// Export all services
export {
  wikipediaService,
  wikivoyageService,
  dataCollectionService,
  contentGenerationService,
  ttsService,
  audioGuideController
};

// Export the main controller as default
export default audioGuideController; 