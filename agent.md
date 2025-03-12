# Adding a Live Conversational Agent to Audio Guide

This document outlines the implementation plan for adding a real-time conversational storytelling agent to the existing Audio Guide application.

## Overview

The current Audio Guide system generates static audio content about Points of Interest (POIs) using data from Wikipedia and Wikivoyage. The proposed enhancement will add a conversational layer that allows users to ask questions, engage in storytelling, and get personalized information about the POIs in real-time.

## Architecture

![Conversational Agent Architecture](./docs/images/conversational-agent-architecture.jpg)

### Components

1. **User Interface**
   - Chat interface within the tour view
   - Voice input capabilities (optional)
   - Typing indicators and rich message formatting

2. **Conversation Manager**
   - Maintains chat history and context
   - Handles message threading
   - Manages user session state

3. **RAG Engine**
   - Enhanced retrieval system using existing Wikipedia/Wikivoyage data
   - Vector database for semantic search
   - Document chunking and embedding

4. **Orchestration Layer**
   - Coordinates between RAG and LLM
   - Manages conversation context
   - Handles rate limiting and error recovery

5. **Response Generator**
   - LLM for generating conversational responses
   - Personality and tone management
   - Formatting and structuring replies

## Implementation Steps

### 1. Vector Database Setup

Set up a vector database (like Supabase with pgvector) to store embeddings of your POI content:

```typescript
// Create schema for vector storage
const createVectorStore = async () => {
  const { error } = await supabase.rpc('create_extension', { 
    name: 'vector' 
  });
  
  // Create embeddings table
  await supabase.query(`
    CREATE TABLE IF NOT EXISTS poi_embeddings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      poi_id UUID REFERENCES "Poi"(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding VECTOR(1536) NOT NULL,
      metadata JSONB
    )
  `);
  
  // Create index for similarity search
  await supabase.query(`
    CREATE INDEX ON poi_embeddings 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100)
  `);
};
```

### 2. Content Embedding

Modify your content generation pipeline to create and store embeddings:

```typescript
// src/services/embeddingService.ts
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';
import { PoiData } from './audioGuide/dataCollectionService';

export async function createEmbeddingsForPoi(poiId: string, content: AudioGuideContent) {
  const supabase = await createClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Split content into chunks (approx 500 tokens each)
  const chunks = [
    { type: 'core', content: content.core },
    { type: 'secondary', content: content.secondary },
    ...splitIntoChunks(content.tertiary, 2000).map((chunk, i) => ({ 
      type: `tertiary_${i+1}`, 
      content: chunk 
    }))
  ];
  
  // Generate embeddings for each chunk
  for (const chunk of chunks) {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk.content,
    });
    
    const embedding = response.data[0].embedding;
    
    // Store embedding in vector database
    await supabase.from('poi_embeddings').insert({
      poi_id: poiId,
      content_type: chunk.type,
      content: chunk.content,
      embedding,
      metadata: { source: 'audio_guide', length: chunk.content.length }
    });
  }
}

// Helper function to split text into chunks
function splitIntoChunks(text: string, chunkSize: number): string[] {
  // Implementation here...
}
```

### 3. Conversation Management Service

Create a service to manage conversation state and context:

```typescript
// src/services/conversationService.ts
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationContext {
  poiId: string;
  messages: Message[];
  metadata: {
    poiName: string;
    userPreferences?: any;
    lastUpdated: string;
  };
}

export async function getConversationHistory(
  userId: string, 
  poiId: string
): Promise<ConversationContext> {
  const supabase = await createClient();
  
  // Get conversation from database
  const { data, error } = await supabase
    .from('conversations')
    .select('messages, metadata')
    .eq('user_id', userId)
    .eq('poi_id', poiId)
    .single();
  
  if (error || !data) {
    // Initialize new conversation
    return {
      poiId,
      messages: [
        { 
          role: 'system', 
          content: 'You are a knowledgeable and engaging tour guide.' 
        }
      ],
      metadata: {
        poiName: await getPoiName(poiId),
        lastUpdated: new Date().toISOString()
      }
    };
  }
  
  return {
    poiId,
    messages: data.messages,
    metadata: data.metadata
  };
}

export async function addMessageToConversation(
  userId: string,
  poiId: string,
  message: Message
): Promise<void> {
  const supabase = await createClient();
  
  // Get existing conversation
  const conversation = await getConversationHistory(userId, poiId);
  
  // Add new message
  conversation.messages.push(message);
  conversation.metadata.lastUpdated = new Date().toISOString();
  
  // Update or insert conversation
  const { error } = await supabase
    .from('conversations')
    .upsert({
      user_id: userId,
      poi_id: poiId,
      messages: conversation.messages,
      metadata: conversation.metadata,
      updated_at: new Date().toISOString()
    });
  
  if (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

// Helper to get POI name
async function getPoiName(poiId: string): Promise<string> {
  // Implementation here...
}
```

### 4. RAG Query Service

Create a service to perform semantic search and retrieve relevant information:

```typescript
// src/services/ragService.ts
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

export async function retrieveRelevantContext(poiId: string, query: string): Promise<string> {
  const supabase = await createClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Generate embedding for the query
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  
  // Perform similarity search
  const { data: matches, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 3,
    poi_id_filter: poiId
  });
  
  if (error) {
    console.error('Error performing similarity search:', error);
    throw error;
  }
  
  // Combine content from matches
  let context = matches.map(match => match.content).join('\n\n');
  
  // If context is too small, get additional general info
  if (context.length < 200) {
    const { data } = await supabase
      .from('poi_embeddings')
      .select('content')
      .eq('poi_id', poiId)
      .eq('content_type', 'core')
      .single();
    
    if (data) {
      context = data.content + '\n\n' + context;
    }
  }
  
  return context;
}
```

### 5. Conversation API Endpoint

Create an API endpoint to handle the conversation:

```typescript
// src/app/api/conversation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';
import { getConversationHistory, addMessageToConversation } from '@/services/conversationService';
import { retrieveRelevantContext } from '@/services/ragService';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request
    const { poiId, message } = await request.json();
    
    if (!poiId || !message) {
      return NextResponse.json(
        { error: 'POI ID and message are required' },
        { status: 400 }
      );
    }
    
    // Add user message to conversation
    await addMessageToConversation(session.user.id, poiId, {
      role: 'user',
      content: message
    });
    
    // Get conversation history
    const conversation = await getConversationHistory(session.user.id, poiId);
    
    // Retrieve relevant context using RAG
    const context = await retrieveRelevantContext(poiId, message);
    
    // Prepare messages for LLM
    const messagesToSend = [
      {
        role: 'system',
        content: `You are a knowledgeable and engaging tour guide for ${conversation.metadata.poiName}. 
          Use the following information to answer the user's questions. 
          Be conversational, friendly, and informative.
          
          REFERENCE INFORMATION:
          ${context}
          
          Don't mention that you're using reference information. Just respond naturally as a guide.`
      },
      ...conversation.messages.slice(-10) // Only use the last 10 messages for context window management
    ];
    
    // Generate response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messagesToSend,
      temperature: 0.7,
    });
    
    const assistantResponse = completion.choices[0].message.content;
    
    // Add assistant response to conversation
    await addMessageToConversation(session.user.id, poiId, {
      role: 'assistant',
      content: assistantResponse
    });
    
    return NextResponse.json({
      message: assistantResponse,
      conversationId: `${session.user.id}_${poiId}`
    });
  } catch (error) {
    console.error('Error in conversation endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process conversation' },
      { status: 500 }
    );
  }
}
```

### 6. UI Components

Create React components for the conversation interface:

```typescript
// src/components/ConversationUI.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationUIProps {
  poiId: string;
  poiName: string;
}

export default function ConversationUI({ poiId, poiName }: ConversationUIProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load conversation history on mount
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const response = await fetch(`/api/conversation/history?poiId=${poiId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      }
    };
    
    if (user && poiId) {
      loadConversation();
    }
  }, [poiId, user]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async () => {
    if (!input.trim() || !user) return;
    
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poiId, message: input })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Add assistant response
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        console.error('Error from API:', await response.json());
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-purple-900/30 overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-lg font-semibold text-white">Chat with Tour Guide</h3>
        <p className="text-sm text-gray-400">Ask questions about {poiName}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>Start a conversation about {poiName}</p>
          </div>
        )}
        
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user' 
                  ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white' 
                  : 'bg-slate-800 text-white'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-white max-w-[80%] rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-slate-800">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this location..."
            className="flex-1 px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-md hover:opacity-90 transition duration-200 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 7. Database Schema Updates

Update your database schema to include tables for conversations and embeddings:

```sql
-- Create conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  poi_id UUID REFERENCES "Poi"(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, poi_id)
);

-- Create poi_embeddings table (if not created by the function above)
CREATE TABLE poi_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poi_id UUID REFERENCES "Poi"(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create stored procedure for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  poi_id_filter UUID
)
RETURNS TABLE (
  id UUID,
  poi_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.poi_id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM poi_embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (poi_id_filter IS NULL OR e.poi_id = poi_id_filter)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

## Integration with the Tour View

Update your tour view to include the conversation component:

```typescript
// Update src/app/(protected)/tour/[id]/page.tsx
// Add the conversation component alongside the audio content

import ConversationUI from '@/components/ConversationUI';

// Other imports and component code...

export default function TourPage({ params }) {
  // Existing component code...
  
  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* Left side - Map and POI list */}
      <div className="w-full lg:w-2/3 h-full">
        {/* Existing map and POI components */}
      </div>
      
      {/* Right side - Current POI info with tabs */}
      <div className="w-full lg:w-1/3 h-full overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-950">
          <h2 className="text-xl font-bold text-white">{currentPoi?.name}</h2>
          {/* Other POI info */}
        </div>
        
        {/* Tab navigation */}
        <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-2 ${activeTab === 'audio' ? 'border-b-2 border-pink-500 text-white' : 'text-gray-400'}`}
          >
            Audio Guide
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 ${activeTab === 'chat' ? 'border-b-2 border-pink-500 text-white' : 'text-gray-400'}`}
          >
            Chat Guide
          </button>
        </div>
        
        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'audio' && (
            <div className="h-full overflow-y-auto p-4">
              {/* Existing audio guide components */}
            </div>
          )}
          
          {activeTab === 'chat' && currentPoi && (
            <div className="h-full">
              <ConversationUI 
                poiId={currentPoi.id} 
                poiName={currentPoi.name} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Optional Enhancements

1. **Voice Input/Output**: Add speech recognition and synthesis for a fully voice-based interaction.

2. **Multi-POI Awareness**: Allow the agent to reference multiple POIs in the tour when answering questions.

3. **User Preference Learning**: Adapt responses based on user interests and past interactions.

4. **Image Support**: Include relevant images in responses when discussing visual aspects.

5. **Offline Capability**: Cache conversation contexts for limited offline functionality.

## Technical Considerations

1. **Token Usage**: Monitor and optimize token usage for both embeddings and chat completions.

2. **Performance**: Implement caching strategies for frequently asked questions.

3. **Testing**: Create comprehensive tests for RAG accuracy and conversation flow.

4. **Security**: Ensure proper sanitization of user inputs and outputs.

5. **Mobile Optimization**: Ensure the chat interface works well on mobile devices.

## Implementation Phases

1. **Phase 1**: Database setup and embedding generation
2. **Phase 2**: Basic conversation API and simple UI
3. **Phase 3**: Enhanced RAG capabilities and context management
4. **Phase 4**: UI refinements and voice capabilities
5. **Phase 5**: Performance optimization and testing
