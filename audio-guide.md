# Audio Guide Implementation

## Overview

This document outlines our implementation approach for generating, storing, and delivering audio guides for points of interest (POIs) in our tour application. The system uses free public APIs to gather information, leverages GPT for content generation, and employs Text-to-Speech (TTS) for audio creation.

## Current Implementation Status

### Completed Components
- Data collection services implemented for Wikipedia and Wikivoyage APIs
- Content generation service integrated with GPT-4
- Text-to-Speech conversion service using OpenAI's TTS API
- Basic UI components for audio guide generation and playback
- Integration with the tour view page

### In Progress
- Storage implementation for audio files
- Database schema updates for storing audio guide references
- Testing and optimization

## Audio Content Structure

We implement a 3-tier audio content structure to provide users with flexibility in how much information they want to consume:

### Tier 1: Core Layer (30-60 seconds)
- Essential facts and brief description
- "Need to know" information for quick understanding
- Focus on what makes the location significant

### Tier 2: Secondary Layer (1-2 minutes)
- More interesting details and context
- Historical significance, cultural impact
- Unique features or characteristics

### Tier 3: Tertiary Layer (3+ minutes)
- Deep historical context, anecdotes, lesser-known facts
- Comprehensive information for users who want to learn more
- Behind-the-scenes stories, controversies, or interesting connections

Each tier is generated and stored as a separate audio file, allowing users to progressively explore content based on their interest level.

## Data Sources

To minimize costs while maximizing content quality, we utilize these free public APIs:

### Primary Sources
1. **Wikipedia API**
   - Historical and factual information
   - Accessed via MediaWiki API
   - Most reliable for well-known landmarks

2. **Wikivoyage API**
   - Travel-specific content with local context
   - More narrative style than Wikipedia
   - Accessed via MediaWiki API

3. **Wikidata**
   - Structured data about places and attractions
   - Good for extracting facts, dates, and relationships
   - Provides semantic context

### Secondary Sources
4. **OpenStreetMap (OSM)**
   - Geographic data and POI metadata
   - Useful for physical characteristics and location context
   - Good for less notable locations without Wikipedia entries

5. **DBpedia**
   - Structured information extracted from Wikipedia
   - Enriches content with additional structured data

6. **Google Places API** (basic data)
   - We already have access to basic place information
   - Opening hours, ratings, types, etc.

## Current Implementation Flow

### 1. User Interface

We have implemented a simplified approach with the following flow:
1. A single "Generate Audio Guides" button on the tour view page
2. When clicked, this button initiates the audio generation process for all POIs in the tour
3. Once generated, each POI displays four buttons:
   - Three buttons for playing the different audio tiers (30-60s, 1-2m, 3m+)
   - One button to view the full text transcript

This approach simplifies the user experience while still providing access to all content tiers.

### 2. Data Collection Service
```javascript
// We've implemented services for:
// - Wikipedia data collection
// - Wikivoyage data collection
// - Aggregation of data from multiple sources

async function collectPoiData(poi) {
  const wikipediaData = await getWikipediaData(poi.name, poi.location);
  const wikivoyageData = await getWikivoyageData(poi.name, poi.location);
  
  return {
    basicInfo: poi,
    wikipedia: wikipediaData,
    wikivoyage: wikivoyageData
  };
}
```

### 3. Content Generation Service
```javascript
// Server-side API endpoint
async function generateContent(poiData) {
  const prompt = createContentPrompt(poiData);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "Create a 3-tier audio guide narrative based on the provided information."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" }
  });

  // Parse and return the structured content
  return {
    core: content.coreTier,
    secondary: content.secondaryTier,
    tertiary: content.tertiaryTier,
    credits: content.credits
  };
}
```

### 4. Text-to-Speech Service
```javascript
// Server-side API endpoint
async function convertTextToSpeech(content, poiId) {
  // Generate audio for each tier
  const coreAudio = await generateTTS(content.core, "nova");
  const secondaryAudio = await generateTTS(content.secondary, "nova");
  const tertiaryAudio = await generateTTS(content.tertiary, "nova");
  
  // For now, we're returning URLs directly for testing
  // In production, these will be stored in Supabase
  return {
    coreAudioUrl: coreAudio.url,
    secondaryAudioUrl: secondaryAudio.url,
    tertiaryAudioUrl: tertiaryAudio.url
  };
}
```

## Planned Storage Architecture

### Supabase Buckets
We will use Supabase Storage to store audio files:
- Bucket: `audio-guides`
- File naming convention: `{poi_id}_tier{1|2|3}.mp3`
- Public access with cache control
- Files can be set to expire or be retained indefinitely

### Database Schema
```sql
CREATE TABLE poi_audio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poi_id UUID REFERENCES Poi(id),
  tier1_url TEXT NOT NULL,
  tier1_duration INTEGER NOT NULL,
  tier2_url TEXT NOT NULL,
  tier2_duration INTEGER NOT NULL,
  tier3_url TEXT NOT NULL,
  tier3_duration INTEGER NOT NULL,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX poi_audio_poi_id_idx ON poi_audio(poi_id);
```

## Next Steps

1. **Implement Storage Integration**
   - Configure Supabase bucket for audio storage
   - Implement file upload and URL generation
   - Update API endpoints to store and retrieve files

2. **Database Integration**
   - Add the poi_audio table to the database schema
   - Implement queries to save and fetch audio metadata
   - Link audio guides to existing POIs

3. **UI Enhancements**
   - Add loading indicators and progress feedback
   - Implement playback controls (pause, resume, speed)
   - Optimize mobile experience

4. **Testing and Optimization**
   - Test with various POI types and data availability
   - Optimize prompt engineering for better content
   - Implement error handling and fallbacks

## Future Enhancements

1. **Voice Personalization**
   - Multiple voice options
   - Voice selection based on content type

2. **Enhanced Content**
   - Integration with additional free data sources
   - User-contributed content
   - Audio mixing with ambient sounds

3. **Memory Optimization**
   - Compressed audio formats
   - Adaptive quality based on device storage

4. **Analytics**
   - Track which tiers users typically access
   - Identify which POIs generate most interest

5. **Multilingual Support**
   - Translation of content before TTS
   - Language detection based on user settings 