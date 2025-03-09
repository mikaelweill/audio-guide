# Multi-Language Support Implementation Guide

## Overview

This document outlines the implementation strategy for adding multi-language support to our Audio Guide application. The goal is to enable users to experience tours in their preferred language, with both text and audio content properly translated and localized.

## 1. Requirements & Goals

### Core Requirements
- Support for multiple languages in UI elements
- Translation of POI descriptions and audio narrations
- Language preference persistence per user
- Scalable approach to add new languages
- Natural-sounding TTS in various languages

### Initial Language Support
- English (default/source)
- Spanish
- French
- German
- Japanese

### User Experience Goals
- Seamless language switching
- Minimal delay when requesting translated content
- Maintaining high-quality audio experience across languages

## 2. Database Architecture

### New Table: Translations

```sql
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poi_id UUID REFERENCES poi(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('brief', 'detailed', 'complete')),
  language_code TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poi_id, content_type, language_code)
);
```

### User Preferences Update

Add language preference to user profiles:

```sql
ALTER TABLE profiles 
ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en';
```

### Storage Structure

Organize audio files in language-specific folders:

```
Storage Buckets:
audio/
├── en/
│   ├── poi_{id}_brief.mp3
│   ├── poi_{id}_detailed.mp3
│   └── poi_{id}_complete.mp3
├── es/
│   ├── poi_{id}_brief.mp3
│   └── ...
└── ...
```

## 3. Translation Pipeline

### Translation Process Flow

1. **Content Generation (English)**: 
   - Generate base content in English as currently implemented
   - Store in the database as the source text

2. **Translation Request**:
   - When a user requests content in a non-English language
   - Check if translation exists in the database
   - If not, queue a translation job

3. **Translation Execution**:
   - Use OpenAI GPT-4 for high-quality translations
   - Use system prompt optimized for translation accuracy
   - Process in batches to optimize API costs

4. **Audio Generation**:
   - Send translated text to OpenAI TTS API
   - Use language-appropriate voice models
   - Store resulting audio in language-specific storage location

5. **Caching & Delivery**:
   - Cache translations to avoid repeated API calls
   - Generate signed URLs with expiration handling
   - Deliver to client with language metadata

### Translation Implementation

For translation quality, use a specialized GPT-4 system prompt:

```
You are a professional translator specializing in [TARGET_LANGUAGE]. 
Translate the following tour guide content from English to [TARGET_LANGUAGE].
Maintain the informative and engaging tone of the original.
Adapt cultural references when appropriate to resonate with [TARGET_LANGUAGE] speakers.
Preserve all formatting, paragraph breaks, and punctuation structure.
```

## 4. User Interface Considerations

### Language Selection Components

Add the following UI elements:

1. **User Settings**: Language preference selector in user profile
2. **Tour Creation**: Language option during tour generation
3. **Tour Playback**: Language switching option in audio player
4. **Homepage**: Language dropdown in navigation bar

### Language Indicators

- Display language flag/code next to audio content
- Visual indicators for available languages per POI
- Loading states for in-progress translations

## 5. Edge Function Enhancement

### Function Signature Update

Modify the Supabase Edge Function to accept language parameters:

```typescript
// New function signature with language parameter
async function processPOI(poiData: any, language: string = 'en') {
  // ... existing implementation
}
```

### Language-Specific Voice Selection

Add voice selection logic based on language:

```typescript
function selectVoiceForLanguage(language: string): string {
  const voiceMap = {
    'en': 'nova',
    'es': 'alloy',
    'fr': 'echo',
    'de': 'onyx',
    'ja': 'shimmer'
  };
  
  return voiceMap[language] || 'nova';
}
```

### Parallel Processing for Multiple Languages

Implement parallel processing for translations:

```typescript
// Example parallel processing for multiple languages
const languages = ['en', 'es', 'fr'];
const contentPromises = languages.map(lang => 
  processPOIContent(poiData, lang)
);
const results = await Promise.all(contentPromises);
```

## 6. Implementation Phases

### Phase 1: Foundation & Spanish Support

1. Create the translations table
2. Update user profiles with language preference
3. Modify the Edge Function to accept language parameter
4. Implement Spanish translation using OpenAI
5. Update storage structure for language-specific audio
6. Add basic language selection UI

### Phase 2: Expand Language Support

1. Add French and German translation support
2. Implement caching for translations
3. Optimize translation prompts for each language
4. Add batch processing for translations
5. Enhance UI with language availability indicators

### Phase 3: Advanced Features

1. Add Japanese and other non-Latin languages
2. Implement regional dialect options
3. Add language-specific pronunciation dictionaries
4. Support for mixed-language tours
5. Implement user-contributed translation improvements

## 7. API Cost Considerations

### Cost Optimization Strategies

1. **Translation Batching**:
   - Group translation requests for cost efficiency
   - Translate all content types in a single request

2. **Caching**:
   - Implement aggressive caching of translated content
   - Share translations between users

3. **Rate Limiting**:
   - Implement queuing for translation requests
   - Prioritize popular languages and POIs

4. **Incremental Translation**:
   - Initially translate only brief descriptions
   - Translate detailed and complete versions on demand

## 8. Testing Strategy

### Translation Quality Testing

1. **Native Speaker Review**:
   - Recruit native speakers for each language
   - Create review interface for translations
   - Score translations for accuracy and naturalness

2. **Automated Checks**:
   - Verify text length (too short/long indicates issues)
   - Check for untranslated segments
   - Validate special character handling

### Technical Testing

1. **Database Integrity**:
   - Verify foreign key relationships
   - Test concurrent translation requests
   - Validate unique constraint enforcement

2. **Audio Quality**:
   - Test pronunciation of location names
   - Verify audio file generation in all languages
   - Compare audio quality across languages

## 9. Future Considerations

### Potential Enhancements

1. **Real-time Translation**:
   - Support on-the-fly translation for untranslated content
   - Implement progressive loading of translated content

2. **Custom Voices per Language**:
   - Develop language-specific voice personas
   - Support for celebrity or character voices

3. **Dialect Support**:
   - Regional variants of major languages
   - Local terminology and pronunciation

4. **User Contribution System**:
   - Allow users to suggest translation improvements
   - Community voting on best translations

---

This implementation strategy provides a comprehensive approach to adding multi-language support to our Audio Guide application while maintaining scalability, performance, and high-quality user experience. 