# Audio Guide Implementation

## Overview

This document outlines our implementation approach for generating, storing, and delivering audio guides for points of interest (POIs) in our tour application. The system uses free public APIs to gather information, leverages GPT for content generation, and employs Text-to-Speech (TTS) for audio creation.

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

## Implementation Process

### 1. Data Collection
```javascript
async function collectPOIData(poi) {
  // Try to get data from multiple free sources
  const data = {
    basic: poi,  // Google Places data we already have
    wiki: await getWikipediaContent(poi.name),
    travel: await getWikivoyageContent(poi.name),
    structured: await getWikidataInfo(poi.name),
    geo: await getOSMDetails(poi.location)
  };

  return filterAndCombineData(data);
}
```

### 2. Content Generation
```javascript
async function generateAudioContent(combinedData) {
  const prompt = createContentPrompt(combinedData);
  
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

  const content = JSON.parse(response.choices[0].message.content);
  return {
    tier1: content.coreTier,
    tier2: content.secondaryTier,
    tier3: content.tertiaryTier
  };
}
```

### 3. Text-to-Speech Conversion
```javascript
async function generateAudio(content, poiId) {
  const audioFiles = [];
  
  // Generate audio for each tier
  for (let i = 1; i <= 3; i++) {
    const tierContent = content[`tier${i}`];
    const audioResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: tierContent
    });

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const fileName = `${poiId}_tier${i}.mp3`;
    
    // Upload to Supabase bucket
    const { data, error } = await supabase.storage
      .from('audio-guides')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      });
      
    if (error) throw new Error(`Error uploading audio: ${error.message}`);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-guides')
      .getPublicUrl(fileName);
      
    audioFiles.push({
      tier: i,
      url: urlData.publicUrl,
      duration: calculateAudioDuration(audioBuffer)
    });
  }
  
  return audioFiles;
}
```

### 4. Database Storage
```javascript
async function saveAudioMetadata(poiId, audioFiles) {
  const { data, error } = await supabase
    .from('poi_audio')
    .insert({
      poi_id: poiId,
      tier1_url: audioFiles[0].url,
      tier1_duration: audioFiles[0].duration,
      tier2_url: audioFiles[1].url,
      tier2_duration: audioFiles[1].duration,
      tier3_url: audioFiles[2].url,
      tier3_duration: audioFiles[2].duration,
      created_at: new Date().toISOString()
    });
    
  if (error) throw new Error(`Error saving audio metadata: ${error.message}`);
  return data;
}
```

## Storage Architecture

### Supabase Buckets
We use Supabase Storage to store audio files:
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

## User Experience

### Audio Playback Controls
- Play/Pause button for current tier
- "Tell Me More" button to progress to next tier
- Skip to next POI option
- Playback speed control (0.8x, 1x, 1.2x, 1.5x)
- Background playback support
- Automatic pause when headphones disconnected

### Caching Strategy
- Download audio for current tour when tour starts
- Cache audio files for offline use
- Clear cache option for managing storage
- Prefetch next POI's audio while approaching

### Accessibility Features
- Text transcripts available for each audio tier
- Visual indicators during playback
- Compatible with screen readers
- Auto-pause when device is in silent mode

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