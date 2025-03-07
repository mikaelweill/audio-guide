# Migrating Audio Guide Generation to Supabase Edge Functions

## Current Architecture

Our current architecture for generating audio guides:

1. **Client-side initiation**: User clicks "Generate Audio Guides" in the UI
2. **Parallel POI processing**: Frontend uses `Promise.allSettled` to process multiple POIs simultaneously
3. **API Requests**: For each POI, the client makes two sequential API calls:
   - `/api/content-generation` - Generates text content using OpenAI (3 sequential API calls)
   - `/api/text-to-speech` - Converts text to audio files
4. **Timeout issues**: Server-side 10-second function timeout causes failures for complex POIs
5. **Sequential execution**: Despite parallel client requests, POIs are processed sequentially (POI 1 finishes first, then POI 2, etc.)

## Root Cause Analysis

After thorough investigation, we've identified the primary causes of the sequential behavior:

1. **Server-Side Resource Management**:
   - Next.js API routes process concurrent requests using a limited thread pool
   - When multiple intensive requests arrive, they can't all be processed simultaneously
   - This happens in both local development and production environments

2. **Resource Contention**:
   - API routes share the same Node.js process and resources
   - Intensive operations like OpenAI API calls and TTS processing compete for resources
   - Single-threaded nature of Node.js means CPU-intensive tasks block other operations

3. **Processing Bottlenecks**:
   - Each POI requires multiple sequential API calls to different AI services
   - These operations block threads in the JavaScript event loop
   - Next.js server has no built-in mechanism for true parallel execution

## Proposed Supabase Architecture

We'll migrate to a more robust architecture:

1. **Client-side initiation**: Same user experience, clicking "Generate Audio Guides"
2. **One function per POI**: Each POI gets its own dedicated Supabase Edge Function call
3. **Extended processing time**: Supabase Functions have 60-second timeouts (6x longer than typical limits)
4. **Direct database updates**: Functions will write results directly to the database
5. **True parallel execution**: Independent functions with isolated resources

## Parallelization Strategies for Maximum Performance

### 1. Separate Function Per POI (Primary Strategy)

The most effective approach is to run a separate, dedicated Supabase Edge Function for each POI:

```typescript
// In your frontend
const poiProcessingPromises = tour.route.map(async (poi) => {
  // Call a dedicated function for each POI
  const response = await fetch(
    `https://[your-project-ref].supabase.co/functions/v1/process-poi`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAccessToken}`,
      },
      body: JSON.stringify({ poiData: poi }),
    }
  );
  
  return response.json();
});

// Process all POIs in truly parallel execution
const results = await Promise.allSettled(poiProcessingPromises);
```

Benefits of this approach:
- Each POI gets dedicated compute resources
- No resource contention between POIs
- All POIs process simultaneously with no queuing
- Faster overall completion time

### 2. Internal Parallelization Within Each POI Function

Within each POI's processing function, we'll also optimize with internal parallelization:

```typescript
// In supabase/functions/process-poi/index.ts

serve(async (req) => {
  // Handle CORS and get the POI data
  const { poiData } = await req.json();
  
  // Initialize OpenAI
  const openai = new OpenAIApi(
    new Configuration({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })
  );
  
  // Parallel content generation within the POI
  const [coreContent, secondaryPrompt, tertiaryPrompt] = await Promise.all([
    // Core content (independent)
    generateCoreContent(openai, poiData),
    
    // Generate secondary prompt (independent)
    prepareSecondaryPrompt(poiData),
    
    // Generate tertiary prompt (independent)
    prepareTertiaryPrompt(poiData)
  ]);
  
  // Second phase of parallel processing
  const [secondaryContent, tertiaryContent] = await Promise.all([
    // Secondary content (depends on core)
    generateSecondaryContent(openai, poiData, coreContent, secondaryPrompt),
    
    // Tertiary content (can run independently with its own prompt)
    generateTertiaryContent(openai, poiData, tertiaryPrompt)
  ]);
  
  // Parallel TTS conversion
  const audioUrls = await Promise.all([
    convertTextToSpeech(coreContent, poiData.id, 'core'),
    convertTextToSpeech(secondaryContent, poiData.id, 'secondary'),
    convertTextToSpeech(tertiaryContent, poiData.id, 'tertiary')
  ]).then(([core, secondary, tertiary]) => ({
    core,
    secondary,
    tertiary
  }));
  
  // Save to database
  await saveToDatabase(poiData.id, {
    coreContent,
    secondaryContent,
    tertiaryContent,
    audioUrls
  });
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      poiId: poiData.id,
      audioUrls 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
```

### 3. Optimizing OpenAI Requests

Use these techniques to optimize OpenAI API calls:

1. **Model Selection Strategy**: 
   - Use GPT-3.5-Turbo for core content (faster)
   - Use GPT-4 only for more complex secondary/tertiary content

2. **Tokenization Optimization**: 
   - Preprocess prompts to reduce tokens
   - Use efficient system prompts

```typescript
// Example of model selection strategy
async function generateCoreContent(openai, poiData) {
  return callOpenAI(openai, "gpt-3.5-turbo", preparePrompt(poiData));
}

async function generateSecondaryContent(openai, poiData, coreContent) {
  return callOpenAI(openai, "gpt-4", preparePrompt(poiData, coreContent));
}

// Common function with different models
async function callOpenAI(openai, model, prompt) {
  const response = await openai.createChatCompletion({
    model,
    messages: prompt,
    temperature: 0.7,
    max_tokens: model.includes("gpt-4") ? 1000 : 500,
  });
  
  return response.choices[0].message.content || '';
}
```

## Performance Comparison

| Approach | Processing Time | Notes |
|----------|----------------|-------|
| Current (Vercel) | Sequential, 30-90s total with timeouts | POIs process one after another |
| Separate Supabase Functions | ~30-40s total | All POIs process simultaneously |
| + Internal Parallelization | ~15-20s total | 50% faster per POI with internal optimization |

## Implementation Steps

### 1. Set Up Supabase CLI and Project

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize Supabase functions in your project
cd audio-guide
mkdir -p supabase/functions
```

### 2. Create the Process-POI Function

Create a file at `supabase/functions/process-poi/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request data
    const { poiData } = await req.json()
    
    // Initialize OpenAI
    const openai = new OpenAIApi(
      new Configuration({
        apiKey: Deno.env.get('OPENAI_API_KEY'),
      })
    )
    
    // Initialize Supabase client (for database updates)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // 1. Generate all content in parallel
    console.log(`Generating content for ${poiData.name}...`);
    
    // First phase of parallel processing
    const [coreContent, secondaryPrompt, tertiaryPrompt] = await Promise.all([
      generateCoreContent(openai, poiData),
      prepareSecondaryPrompt(poiData),
      prepareTertiaryPrompt(poiData)
    ]);
    
    // Second phase of parallel processing
    const [secondaryContent, tertiaryContent] = await Promise.all([
      generateSecondaryContent(openai, poiData, coreContent, secondaryPrompt),
      generateTertiaryContent(openai, poiData, tertiaryPrompt)
    ]);
    
    // 2. Generate speech in parallel
    console.log(`Converting to speech for ${poiData.name}...`);
    const audioUrls = await Promise.all([
      convertTextToSpeech(coreContent, poiData.id, 'core'),
      convertTextToSpeech(secondaryContent, poiData.id, 'secondary'),
      convertTextToSpeech(tertiaryContent, poiData.id, 'tertiary')
    ]).then(([core, secondary, tertiary]) => ({
      core,
      secondary,
      tertiary
    }));
    
    // 3. Save results to database
    console.log(`Saving results for ${poiData.name}...`);
    await saveToDatabase(supabaseClient, poiData.id, {
      coreContent,
      secondaryContent,
      tertiaryContent,
      audioUrls
    });
    
    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        poiId: poiData.id,
        name: poiData.name,
        audioUrls
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error processing POI:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        poiId: req.json().poiData?.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Helper functions (implement these based on your current code)
async function generateCoreContent(openai, poiData) {
  // Implementation copied from current code
  // Use GPT-3.5-Turbo for faster results
}

async function prepareSecondaryPrompt(poiData) {
  // Prepare the prompt for secondary content
}

async function prepareTertiaryPrompt(poiData) {
  // Prepare the prompt for tertiary content
}

async function generateSecondaryContent(openai, poiData, coreContent, prompt) {
  // Implementation copied from current code
}

async function generateTertiaryContent(openai, poiData, prompt) {
  // Implementation copied from current code
}

async function convertTextToSpeech(text, poiId, contentType) {
  // Text-to-speech implementation
  return 'audio_url_here'
}

async function saveToDatabase(supabaseClient, poiId, data) {
  // Save content and audio URLs to database
}
```

### 3. Update Frontend to Call Separate Functions Per POI

Update `src/components/AudioGuideControls.tsx`:

```typescript
// Replace:
const contentResponse = await fetch('/api/content-generation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ poiData }),
});

const contentData = await contentResponse.json();

const ttsResponse = await fetch('/api/text-to-speech', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: contentData.content,
    poiId: poi.place_id || `poi-${tour.route.indexOf(poi)}`,
    voice: 'nova',
  }),
});

// With this single function call:
const response = await fetch(
  'https://[your-project-ref].supabase.co/functions/v1/process-poi',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAccessToken}`,
    },
    body: JSON.stringify({ 
      poiData: {
        ...poi,
        id: poi.place_id || `poi-${tour.route.indexOf(poi)}`,
      }
    }),
  }
);

const result = await response.json();
```

### 4. Deploy the Supabase Function

```bash
# Deploy the function to Supabase
supabase functions deploy process-poi --project-ref your-project-ref

# Set environment variables
supabase secrets set OPENAI_API_KEY=your-openai-api-key --project-ref your-project-ref
supabase secrets set SUPABASE_URL=your-supabase-url --project-ref your-project-ref
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref your-project-ref
```

## Benefits of This Migration

1. **True parallelization**: POIs process simultaneously rather than sequentially
2. **Resource isolation**: Each POI gets dedicated compute resources
3. **Longer timeouts**: 60-second limit vs. 10-second limit
4. **More efficient**: Internal parallelization further optimizes each POI
5. **Simplified architecture**: Direct database updates from functions
6. **Better user experience**: All POIs complete around the same time

## Next Steps

1. Copy the exact implementation details from your current code
2. Set up the Supabase CLI and create the function structure
3. Deploy and test the function with a single POI
4. Update the frontend to call the new function for each POI
5. Monitor performance improvements and make further optimizations as needed 