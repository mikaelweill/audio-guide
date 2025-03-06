/**
 * Content Generation Service
 * 
 * Generates audio guide content using GPT based on collected POI data
 */

import OpenAI from 'openai';
import { PoiData } from './dataCollectionService';

// Don't initialize OpenAI globally - will do it per-function
// to support both server and client-side usage

export interface AudioGuideContent {
  core: string;      // 30-60 second essential content
  secondary: string; // 1-2 minute additional content
  tertiary: string;  // 3+ minute deep context
  credits: string;   // Attribution for data sources
}

// Helper to get an OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Please add it to your environment variables.');
  }
  
  return new OpenAI({ apiKey });
}

/**
 * Generate core audio content (30-60 seconds) with essential facts
 */
async function generateCoreContent(poiData: PoiData): Promise<string> {
  const openai = getOpenAIClient();
  
  const prompt = `
    Create a concise 30-60 second audio guide script about "${poiData.basic.name}".
    Focus only on the most important and interesting facts.
    Use a conversational, engaging tone as if speaking to a tourist.
    Include only essential historical context, significance, and main features.
    
    Use this information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract.substring(0, 500)}...` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide: ${poiData.wikivoyage.seeSection.substring(0, 500)}...` : ''}
    ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract.substring(0, 300)}...` : ''}
    
    The script should be brief but insightful, about 100-150 words total.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert tour guide creating audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  
  return response.choices[0].message.content || '';
}

/**
 * Generate secondary content (1-2 minutes) with additional details
 */
async function generateSecondaryContent(poiData: PoiData, coreContent: string): Promise<string> {
  const openai = getOpenAIClient();
  
  const prompt = `
    Create an additional 1-2 minute audio guide script for "${poiData.basic.name}" that builds upon this core content:
    
    "${coreContent}"
    
    This secondary content should:
    - Provide more details about architectural features, artistic significance, or historical events
    - Include interesting anecdotes or lesser-known facts
    - Explain cultural context or impact
    - Offer more detailed descriptions
    
    Use this additional information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide (See section): ${poiData.wikivoyage.seeSection}` : ''}
    ${poiData.wikivoyage?.doSection ? `Travel guide (Do section): ${poiData.wikivoyage.doSection}` : ''}
    
    The script should be about 250-300 words in a conversational style, as if speaking directly to a tourist.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert tour guide creating detailed audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  return response.choices[0].message.content || '';
}

/**
 * Generate tertiary content (3+ minutes) with deep context and stories
 */
async function generateTertiaryContent(poiData: PoiData, previousContent: string): Promise<string> {
  const openai = getOpenAIClient();
  
  const prompt = `
    Create an extended 3+ minute audio guide script for "${poiData.basic.name}" that provides deep context beyond this previous content:
    
    "${previousContent.substring(0, 300)}..."
    
    This tertiary content should:
    - Provide in-depth historical analysis 
    - Share detailed stories and significant events connected to this place
    - Examine cultural impact and significance in depth
    - Discuss artistic or architectural details
    - Mention connections to other important sites or historical figures
    - Include interesting debates or different perspectives about this place
    
    Use all available information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
    ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract}` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide (See): ${poiData.wikivoyage.seeSection}` : ''}
    ${poiData.wikivoyage?.doSection ? `Travel guide (Do): ${poiData.wikivoyage.doSection}` : ''}
    
    The script should be 500-600 words in a conversational, engaging style.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert historian and tour guide creating in-depth audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });
  
  return response.choices[0].message.content || '';
}

/**
 * Generate credits section for attribution
 */
function generateCredits(poiData: PoiData): string {
  const credits = ['Information provided by:'];
  
  if (poiData.wikipedia) {
    credits.push(`Wikipedia: "${poiData.wikipedia.title}" - ${poiData.wikipedia.url}`);
  }
  
  if (poiData.wikivoyage) {
    credits.push(`Wikivoyage: "${poiData.wikivoyage.title}" - ${poiData.wikivoyage.url}`);
  }
  
  return credits.join('\n');
}

/**
 * Generate complete audio guide content with all layers
 */
export async function generateAudioGuideContent(poiData: PoiData): Promise<AudioGuideContent> {
  // Generate core content first
  const core = await generateCoreContent(poiData);
  
  // Generate secondary content based on core
  const secondary = await generateSecondaryContent(poiData, core);
  
  // Generate tertiary content based on previous content
  const tertiary = await generateTertiaryContent(poiData, core + "\n\n" + secondary);
  
  // Generate credits
  const credits = generateCredits(poiData);
  
  return {
    core,
    secondary,
    tertiary,
    credits
  };
}

export default {
  generateAudioGuideContent
}; 