'use client';

import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tour, TourPoi } from '@/components/TourList';
import { dataCollectionService } from '@/services/audioGuide';
import { getImageUrl, getImageAttribution } from '@/utils/images';
import POIImage from '@/components/POIImage';
import { useRTVIClient, RTVIClientProvider, RTVIClientAudio } from '@pipecat-ai/client-react';
import { RTVIClient } from '@pipecat-ai/client-js';
import { DailyTransport } from '@pipecat-ai/daily-transport';
import { useAgent } from '@/context/AgentContext';

// Debug logging
const PAGE_DEBUG = true;
const logPage = (...args: any[]) => {
  if (PAGE_DEBUG) {
    console.log(`📄 TOUR PAGE [${new Date().toISOString().split('T')[1].split('.')[0]}]:`, ...args);
  }
};

// Initialize client
const getAgentPrompt = (poi: any) => {
  if (!poi) return "You are an AI tour guide assistant. You are enthusiastic, knowledgeable, and helpful. Keep your responses brief and conversational, as they will be spoken out loud. Your responses will be converted to audio, so speak naturally.";
  
  // Format types into readable categories
  const formatTypes = (types: string[] | null) => {
    if (!types || !Array.isArray(types)) return "Not available";
    return types.map(type => type.replace(/_/g, ' ')).join(', ');
  };
  
  // Format opening hours into readable text
  const formatOpeningHours = (hours: any) => {
    if (!hours || !hours.weekday_text || !Array.isArray(hours.weekday_text)) return "Not available";
    return hours.weekday_text.join('\n');
  };
  
  // Format key facts from poi_knowledge if available
  const formatKeyFacts = (keyFacts: any) => {
    if (!keyFacts || typeof keyFacts !== 'object') return "";
    
    return Object.entries(keyFacts)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
  };
  
  // Format interesting trivia from poi_knowledge if available
  const formatTrivia = (trivia: any[]) => {
    if (!trivia || !Array.isArray(trivia) || trivia.length === 0) return "";
    
    return trivia.map(item => `- ${item}`).join('\n');
  };
  
  // Combine all transcripts into knowledge base for the AI
  const basicKnowledge = [
    poi.brief_transcript,
    poi.detailed_transcript,
    poi.complete_transcript
  ].filter(Boolean).join('\n\n');
  
  // Check if poi_knowledge exists and extract data
  const poiKnowledge = poi.poiKnowledge || {};
  
  // Build comprehensive knowledge base with ALL existing poi_knowledge fields
  const advancedKnowledge = [
    poiKnowledge.overview && `OVERVIEW:\n${poiKnowledge.overview}`,
    poiKnowledge.historical_context && `HISTORICAL CONTEXT:\n${poiKnowledge.historical_context}`,
    poiKnowledge.architectural_details && `ARCHITECTURAL DETAILS:\n${poiKnowledge.architectural_details}`,
    poiKnowledge.cultural_significance && `CULTURAL SIGNIFICANCE:\n${poiKnowledge.cultural_significance}`,
    poiKnowledge.visitor_experience && `VISITOR EXPERIENCE:\n${poiKnowledge.visitor_experience}`,
    poiKnowledge.practical_info && `PRACTICAL INFORMATION:\n${poiKnowledge.practical_info}`,
    poiKnowledge.key_facts && `KEY FACTS:\n${formatKeyFacts(poiKnowledge.key_facts)}`,
    poiKnowledge.interesting_trivia && poiKnowledge.interesting_trivia.length > 0 && `INTERESTING TRIVIA:\n${formatTrivia(poiKnowledge.interesting_trivia)}`,
    poiKnowledge.opening_hours_notes && `OPENING HOURS NOTES:\n${poiKnowledge.opening_hours_notes}`,
    poiKnowledge.admission_fee && `ADMISSION FEE:\n${poiKnowledge.admission_fee}`,
    poiKnowledge.best_time_to_visit && `BEST TIME TO VISIT:\n${poiKnowledge.best_time_to_visit}`,
    poiKnowledge.nearby_attractions && `NEARBY ATTRACTIONS:\n${poiKnowledge.nearby_attractions}`,
    poiKnowledge.fun_facts && `FUN FACTS:\n${poiKnowledge.fun_facts}`,
    poiKnowledge.local_tips && `LOCAL TIPS:\n${poiKnowledge.local_tips}`,
    poiKnowledge.events && `EVENTS:\n${poiKnowledge.events}`,
    poiKnowledge.additional_notes && `ADDITIONAL NOTES:\n${poiKnowledge.additional_notes}`
  ].filter(Boolean).join('\n\n');
  
  // Combine basic and advanced knowledge
  const knowledgeBase = [basicKnowledge, advancedKnowledge].filter(Boolean).join('\n\n');
  
  // Add source information if available
  const sources = [
    poiKnowledge.source_wikipedia && `Wikipedia: ${poiKnowledge.source_wikipedia}`,
    poiKnowledge.source_wikivoyage && `Wikivoyage: ${poiKnowledge.source_wikivoyage}`,
    poiKnowledge.source_official && `Official: ${poiKnowledge.source_official}`,
    poiKnowledge.additional_sources && `Additional Sources: ${poiKnowledge.additional_sources}`
  ].filter(Boolean);
  
  const sourceInfo = sources.length > 0 ? `\n\nSOURCES:\n${sources.join('\n')}` : '';
  
  return `You are an AI tour guide assistant for ${poi.name}. 
  
Here's information about this location:
- Name: ${poi.name}
- Address: ${poi.formatted_address || 'Not available'}
- Categories: ${formatTypes(poi.types)}
- Rating: ${poi.rating ? `${poi.rating}/5` : 'Not available'}
${poi.user_ratings_total ? `- Total Ratings: ${poi.user_ratings_total}` : ''}
${poi.website ? `- Website: ${poi.website}` : ''}
${poi.phone_number ? `- Phone: ${poi.phone_number}` : ''}
${poi.opening_hours ? `- Hours: ${formatOpeningHours(poi.opening_hours)}` : ''}
${poi.vicinity ? `- Vicinity: ${poi.vicinity}` : ''}
${poi.google_maps_url ? `- Google Maps: ${poi.google_maps_url}` : ''}
${poi.price_level ? `- Price Level: ${poi.price_level}/4` : ''}
${poi.image_attribution ? `- Image Credit: ${poi.image_attribution}` : ''}

${knowledgeBase ? `KNOWLEDGE BASE:\n${knowledgeBase}${sourceInfo}` : ''}

You are enthusiastic, knowledgeable, and helpful. Keep your responses brief and conversational, as they will be spoken out loud. Your responses will be converted to audio, so speak naturally.

If users ask about this location, share interesting facts and information based on what you know. If asked about something you don't know, you can say you don't have that specific information.

Important guidelines:
1. Never mention "KNOWLEDGE BASE", "OVERVIEW", "HISTORICAL CONTEXT" or any of the section headings in your responses
2. Present the information naturally as if you're a knowledgeable guide
3. Keep responses concise and engaging
4. Prioritize the most interesting information first
5. If the user asks about something specific, focus your response on that topic
6. For practical information like hours, prices, or accessibility, be direct and accurate
7. If discussing practical info like admission fees or opening hours, mention when this information might change and suggest checking official sources for the most current details
8. If the locality information is available: ${poiKnowledge.locale ? `The primary language here is ${poiKnowledge.locale}` : 'The primary language here is likely English'}`;
};

// Default system prompt for the voice agent
const DEFAULT_SYSTEM_PROMPT = `You are a helpful, knowledgeable tour guide assistant. 
You speak in a conversational, friendly tone and keep your answers brief and informative. 
When you don't know something, you admit it rather than making things up.
If the user doesn't explicitly ask about a specific place, provide general travel information or assistance.
When the user asks about a specific location, share interesting facts and information about it based on what you know.
Do not mention "knowledge base" or "transcripts" in your responses. Just use the information as if it's your own knowledge.
Your responses will be spoken out loud, so keep them succinct and easy to listen to.`;

// VoiceAgentButton component - updated to work with clientRef
function VoiceAgentButton({ currentPoi, clientRef }: { currentPoi: any, clientRef: React.RefObject<RTVIClient | null> }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check the actual client connection state when the component mounts or clientRef changes
  useEffect(() => {
    const checkConnectionState = async () => {
      try {
        const client = clientRef.current;
        if (client) {
          // Get the current connection state from the client
          // Use the correct property to check connection state
          const isConnected = client.connected;
          console.log(`VoiceAgentButton: Syncing button state with client. Client connected: ${isConnected}`);
          
          // Update our state to match the actual client state
          if (isConnected !== connected) {
            setConnected(isConnected);
          }
        }
      } catch (err) {
        console.error('Error checking client connection state:', err);
      }
    };
    
    checkConnectionState();
    
    // Set up an interval to check connection state periodically
    const intervalId = setInterval(checkConnectionState, 2000);
    return () => clearInterval(intervalId);
  }, [clientRef, connected]);
  
  const handleConnect = async () => {
    setError(null);
    
    const client = clientRef.current;
    if (!client) {
      console.error('RTVIClient not available');
      setError('Voice client not available');
      return;
    }
    
    // If already connected, disconnect
    if (connected || client.connected) {
      try {
        setDisconnecting(true);
        await client.disconnect();
        setConnected(false);
        console.log('Disconnected from voice agent');
      } catch (error) {
        console.error('Failed to disconnect from voice agent:', error);
        setError('Failed to disconnect');
      } finally {
        setDisconnecting(false);
      }
      return;
    }
    
    // Connect to the voice agent - use try/catch for full error handling
    try {
      setConnecting(true);
      
      // First ensure we're not already connected
      if (client.connected) {
        console.log("Client is already connected according to its state. Updating button state.");
        setConnected(true);
        setConnecting(false);
        return;
      }
      
      // Connect with the current POI information already in the client configuration
      await client.connect();
      setConnected(true);
      console.log('Connected to voice agent');
      
      // Start a conversation about the current POI after connection
      if (currentPoi) {
        setTimeout(() => {
          try {
            // Send dummy user transcript to trigger the bot to talk about this POI
            const event = new CustomEvent('user_audio_transcript', {
              detail: { text: `Tell me about ${currentPoi.name}` }
            });
            window.dispatchEvent(event);
            console.log('Triggered initial conversation about', currentPoi.name);
          } catch (error) {
            console.error('Failed to trigger conversation:', error);
          }
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to connect to voice agent:', error);
      
      // Special handling for "already started" error
      if (error.message && error.message.includes('already been started')) {
        console.log('Client is already connected but we tried to connect again. Fixing state...');
        setConnected(true);
        // No need to show error to user in this case, just fix the state
      } else {
        setError(error?.message || 'Connection failed');
      }
    } finally {
      setConnecting(false);
    }
  };
  
  // If a client was just newly created after the button was already in connected state,
  // this makes sure we maintain proper state
  useEffect(() => {
    if (connected && !clientRef.current) {
      setConnected(false);
    }
  }, [clientRef, connected]);
  
  // Debug the connected state
  useEffect(() => {
    console.log(`VoiceAgentButton state changed - connected: ${connected}`);
  }, [connected]);
  
  return (
    <div className="relative">
      <button
        onClick={handleConnect}
        disabled={connecting || disconnecting}
        data-voice-agent-connected={connected ? "true" : "false"}
        className={`px-4 py-2 rounded-full font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
          connected 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
            : connecting
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : disconnecting
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'bg-purple-600/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
        }`}
      >
        {connected ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Click to disconnect
          </>
        ) : disconnecting ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Disconnecting...
          </>
        ) : connecting ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Connect to voice agent
          </>
        )}
      </button>
      {error && (
        <div className="text-xs text-red-400 absolute -bottom-5 left-0 whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}

export default function TourPage() {
  // Don't log on every render - this causes React DevTools to trigger re-renders
  // logPage('Component rendering');
  const mountCountRef = useRef(0);
  const renderCountRef = useRef(0);
  
  // Track page lifecycle and loading performance
  useEffect(() => {
    renderCountRef.current += 1;
    logPage(`Component rendering (render #${renderCountRef.current})`);
    
    mountCountRef.current += 1;
    logPage(`Mounted (count: ${mountCountRef.current})`);
    
    // Performance tracking from navigation
    if (typeof window !== 'undefined' && window._navTimestamp) {
      const navigationTime = Date.now() - window._navTimestamp;
      logPage(`Page loaded ${navigationTime}ms after navigation started`);
      
      // Clear the timestamp since we've used it
      window._navTimestamp = undefined;
    }
    
    // Log URL parameters and state
    logPage('URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
    logPage('Pathname:', typeof window !== 'undefined' ? window.location.pathname : 'SSR');
    
    // Log cookie state on mount
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
      logPage(`Cookies on mount: ${cookies.join(', ') || 'none'}`);
    }
    
    return () => {
      logPage(`Unmounting (count: ${mountCountRef.current})`);
    };
  }, []);

  const params = useParams();
  const router = useRouter();
  const tourId = params.id as string;
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State to track the current stop in the tour
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  
  // Audio guide generation states
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioData, setAudioData] = useState<Record<string, any>>({});
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerationStep, setCurrentGenerationStep] = useState('');
  
  // Audio playback states
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<'brief' | 'detailed' | 'in-depth' | null>(null);
  
  // Add these state variables to your component
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  
  // Add playback speed state
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Add this state variable to track the visible transcript
  const [showTranscript, setShowTranscript] = useState(false);
  
  // Add state for transcript highlighting
  const [highlightPosition, setHighlightPosition] = useState(0);
  const [sentences, setSentences] = useState<{text: string, endIndex: number}[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Add a ref to track current time without causing re-renders
  const currentTimeRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const TIME_UPDATE_THROTTLE = 250; // Only update time display every 250ms
  
  // Memoize this function to prevent it from being recreated on each render
  const getGoogleMapsUrl = useCallback((poi: any) => {
    // Try using place_id first (most reliable)
    if (poi.id && poi.id.startsWith('ChI')) {
      return `https://www.google.com/maps/place/?q=place_id:${poi.id}`;
    }
    
    // Try using formatted address if available
    if (poi.formatted_address) {
      const encodedAddress = encodeURIComponent(poi.formatted_address);
      return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }
    
    // If we have coordinates, use those as fallback
    if (poi.location && typeof poi.location === 'object' && poi.location.lat && poi.location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${poi.location.lat},${poi.location.lng}`;
    }
    
    // Fallback to using the name if we have it
    if (poi.name) {
      const encodedName = encodeURIComponent(poi.name);
      return `https://www.google.com/maps/search/?api=1&query=${encodedName}`;
    }
    
    // Final fallback - generic Google Maps link
    return "https://www.google.com/maps";
  }, []);
  
  // Fetch tour data
  useEffect(() => {
    fetchTour();
  }, [tourId]);
  
  // Add this memoized fetchTour function before the useEffect
  const fetchTour = useCallback(async () => {
    // Create abort controller for timeout management
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('Aborting tour fetch due to timeout');
      controller.abort();
    }, 8000); // 8 second timeout
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        signal: controller.signal // Use the abort controller
      });
      
      // Clear timeout since request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Tour fetch failed with status: ${response.status}`);
        
        // Handle authentication errors specially
        if (response.status === 401) {
          console.error('Authentication error - not logged in or session expired');
          setError('Authentication error: You need to log in again');
          // No need to redirect - protected layout will handle this
          setLoading(false);
          return;
        }
        
        try {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          
          // Try to parse the error as JSON if possible
          try {
            const errorJson = JSON.parse(errorText);
            setError(errorJson.error || `Error ${response.status}: Failed to load tour`);
          } catch (e) {
            // If not JSON, use the raw text
            setError(`Error ${response.status}: ${errorText}`);
          }
        } catch (textError) {
          setError(`Error ${response.status}: Failed to load tour data`);
        }
        
        throw new Error(`Error fetching tour: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.tour) {
        console.log('Tour data fetched successfully');
        setTour(data.tour);
        
        // Once the tour is loaded, fetch any existing audio guides
        fetchExistingAudioGuides(data.tour.tourPois);
        
        // Handle warning about ownership if present
        if (data.warning) {
          console.warn(data.warning);
        }
      } else {
        setError(data.error || 'Failed to load tour data');
      }
    } catch (error: any) {
      // Handle abort error specially
      if (error.name === 'AbortError') {
        console.error('Tour fetch aborted due to timeout');
        setError('Request timed out. The server took too long to respond. Please try again later.');
      } else {
        console.error('Error fetching tour:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
      // Ensure timeout is cleared in all cases
      clearTimeout(timeoutId);
    }
  }, [tourId]);
  
  // Also memoize this function
  const fetchExistingAudioGuides = useCallback(async (tourPois: any[]) => {
    console.log('Checking for existing audio guides...');
    
    try {
      // Check if pois exist in the tour
      if (!tourPois || tourPois.length === 0) {
        console.log('No POIs found in the tour, cannot fetch audio guides');
        return;
      }
      
      // Map POIs to their IDs for the API call
      const poiIds = tourPois.map(tourPoi => tourPoi.poi.id || `poi-${tourPoi.sequence_number}`);
      console.log('POI IDs to check for audio:', poiIds);
      
      // Call an API endpoint to get existing audio guides
      const response = await fetch('/api/audio-guide/fetch-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ poiIds }),
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch existing audio guides: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.audioGuides) {
        console.log('Found existing audio guides:', data.audioGuides);
        // Update the audio data state with existing guides
        setAudioData(data.audioGuides);
      }
    } catch (error) {
      console.error('Error fetching existing audio guides:', error);
    }
  }, []);
  
  // Navigate to the next or previous stop
  const goToStop = (index: number) => {
    if (tour && tour.tourPois.length > 0) {
      if (index >= 0 && index < tour.tourPois.length) {
        setCurrentStopIndex(index);
      }
    }
  };
  
  // Format duration for display
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };
  
  // Function to generate audio guides for all POIs in the tour
  const handleGenerateAudioGuides = async () => {
    if (!tour || !tour.tourPois || tour.tourPois.length === 0) {
      alert('No POIs found in this tour');
      return;
    }

    setIsGeneratingAudio(true);
    setCurrentGenerationStep('Starting audio guide generation...');
    setGenerationProgress(0);

    try {
      const audioResults: Record<string, any> = {};
      const totalPois = tour.tourPois.length;
      const sortedPois = [...tour.tourPois].sort((a, b) => a.sequence_number - b.sequence_number);

      // Process each POI in the tour
      for (let i = 0; i < totalPois; i++) {
        const poiData = sortedPois[i].poi;
        const progressPercent = Math.round((i / totalPois) * 100);
        setGenerationProgress(progressPercent);
        
        setCurrentGenerationStep(`Collecting data for ${poiData.name} (${i + 1}/${totalPois})...`);
        
        // 1. Collect data from sources
        const enrichedPoiData = await dataCollectionService.collectPoiData({
          name: poiData.name,
          formatted_address: poiData.formatted_address || '',
          location: poiData.location || null,
          types: poiData.types || [],
          rating: poiData.rating,
          photo_references: poiData.photo_references || []
        });

        setCurrentGenerationStep(`Generating content for ${poiData.name} (${i + 1}/${totalPois})...`);
        
        // 2. Generate content using the server-side API
        const contentResponse = await fetch('/api/content-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ poiData: enrichedPoiData }),
        });

        if (!contentResponse.ok) {
          throw new Error(`Failed to generate content for ${poiData.name}`);
        }

        const contentData = await contentResponse.json();
        
        setCurrentGenerationStep(`Converting to speech for ${poiData.name} (${i + 1}/${totalPois})...`);
        
        // 3. Convert to speech using the server-side API
        const ttsResponse = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: contentData.content,
            poiId: poiData.id || `poi-${i}`,
            voice: 'nova', // Default voice
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`Failed to convert text to speech for ${poiData.name}`);
        }

        const audioFiles = await ttsResponse.json();
        
        // Store the results
        audioResults[poiData.id || `poi-${i}`] = {
          name: poiData.name,
          content: contentData.content,
          audioFiles: audioFiles.audioFiles,
        };
      }

      setAudioData(audioResults);
      setCurrentGenerationStep('');
      setGenerationProgress(100);
      
      alert(`Generated audio guides for ${totalPois} POIs`);
    } catch (error) {
      console.error('Error generating audio guides:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate audio guides');
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  // Add this function to format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Update the playAudio function with URL refresh capability
  const playAudio = useCallback(async (url: string, label: string) => {
    console.log(`Attempting to play audio: ${label} from URL: ${url}`);
    
    if (!url) {
      console.error(`No URL provided for ${label} audio`);
      alert(`Error: No audio URL available for ${label}`);
      setIsAudioLoading(false);
      return;
    }
    
    try {
      // Show the transcript for this audio
      console.log("Setting showTranscript to true");
      setShowTranscript(true);
      
      // Get the current POI ID for debugging
      const currentPoiId = currentStop?.poi?.id || `poi-${currentStopIndex}`;
      console.log("Current POI ID:", currentPoiId);
      console.log("Audio data for this POI:", audioData[currentPoiId]);
      
      // Display spinner or loading state first
      setIsAudioLoading(true);
      setCurrentAudioId(label === "Brief Overview" ? 'brief' : label === "Detailed Guide" ? 'detailed' : 'in-depth');
      setActiveAudioUrl(url);
      
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
        audioElement.removeAttribute('src'); // Better than setting to empty string
        audioElement.load();
      }
      
      // Create a new audio element with proper event handling sequence
      const audio = new Audio();
      
      // Debug the URL
      console.log(`Full audio URL: ${url}`);
      
      // Check for URL token expiry
      if (url.includes('?')) {
        const expiryMatch = url.match(/expires=(\d+)/i);
        if (expiryMatch && expiryMatch[1]) {
          const expiryTimestamp = parseInt(expiryMatch[1]);
          const currentTime = Math.floor(Date.now() / 1000);
          const timeLeft = expiryTimestamp - currentTime;
          
          // If URL is expired or about to expire (less than 5 minutes left)
          if (timeLeft <= 300) {
            console.log('Signed URL is expired or about to expire. Refreshing audio URLs...');
            
            // Get the current POI ID and audio type
            const currentPoiId = currentStop?.poi?.id || `poi-${currentStopIndex}`;
            const audioType = label === "Brief Overview" ? 'brief' : 
                            label === "Detailed Guide" ? 'detailed' : 'in-depth';
            
            try {
              // Fetch fresh audio URLs for the current POI
              const refreshResponse = await fetch('/api/audio-guide/fetch-existing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poiIds: [currentPoiId] })
              });
              
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                if (refreshData.success && refreshData.audioGuides && refreshData.audioGuides[currentPoiId]) {
                  // Update audioData state with fresh URLs
                  const freshAudioData = refreshData.audioGuides[currentPoiId];
                  
                  setAudioData(prevData => ({
                    ...prevData,
                    [currentPoiId]: freshAudioData
                  }));
                  
                  // Get the fresh URL based on audio type
                  let freshUrl;
                  if (audioType === 'brief') {
                    freshUrl = freshAudioData.audioFiles.coreAudioUrl;
                  } else if (audioType === 'detailed') {
                    freshUrl = freshAudioData.audioFiles.secondaryAudioUrl;
                  } else {
                    freshUrl = freshAudioData.audioFiles.tertiaryAudioUrl;
                  }
                  
                  if (freshUrl) {
                    console.log(`Using fresh URL for ${label} audio`);
                    url = freshUrl;
                    setActiveAudioUrl(freshUrl);
                  }
                }
              }
            } catch (refreshError) {
              console.error('Error refreshing audio URL:', refreshError);
              // Continue with existing URL as fallback
            }
          }
        }
      }
      
      // Set up error handling first
      audio.addEventListener('error', (e) => {
        console.error(`Audio error for ${label}:`, e);
        console.error('Audio error details:', audio.error);
        
        // Only show alert for permanent errors, not transitional ones
        if (audio.error && audio.error.code !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          const errorMessages: Record<number, string> = {
            [MediaError.MEDIA_ERR_ABORTED]: "Playback aborted by the user",
            [MediaError.MEDIA_ERR_NETWORK]: "Network error while loading the audio",
            [MediaError.MEDIA_ERR_DECODE]: "Error decoding the audio file",
            [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: "Audio format not supported or CORS error"
          };
          
          const errorMessage = errorMessages[audio.error.code] || "Unknown error";
          
          console.warn(`Audio error: ${errorMessage}. Trying with download approach...`);
        }
        
        setIsAudioLoading(false);
        setIsPlaying(false);
      });
      
      // Add a timeout to prevent hanging in loading state
      const loadingTimeout = setTimeout(() => {
        if (isAudioLoading) {
          console.log('Audio loading timeout - resetting loading state');
          setIsAudioLoading(false);
        }
      }, 10000); // 10 second timeout
      
      // Set up metadata and playback events
      audio.addEventListener('loadedmetadata', () => {
        console.log(`Audio metadata loaded for ${label}, duration: ${audio.duration}`);
        setDuration(audio.duration);
        clearTimeout(loadingTimeout);
      });
      
      audio.addEventListener('canplaythrough', () => {
        console.log(`Audio can play through: ${label}`);
        setIsAudioLoading(false);
        clearTimeout(loadingTimeout);
        
        // Set the playback rate from state
        audio.playbackRate = playbackSpeed;
        
        // Auto-play when ready
        audio.play().catch(error => {
          console.error(`Failed to auto-play audio ${label}:`, error);
          
          // For user interaction requirement errors, don't show alert
          if (error.name !== 'NotAllowedError') {
            alert(`Could not play audio: ${error.message}`);
          }
        });
        
        setIsPlaying(true);
      });
      
      // Modify the timeupdate event to use throttling
      audio.addEventListener('timeupdate', () => {
        // Always update the ref in real-time (no re-render)
        currentTimeRef.current = audio.currentTime;
        
        // Only update the state (causing re-render) at throttled intervals
        const now = Date.now();
        if (now - lastTimeUpdateRef.current > TIME_UPDATE_THROTTLE) {
          setCurrentTime(audio.currentTime);
          lastTimeUpdateRef.current = now;
        }
      });
      
      audio.addEventListener('playing', () => {
        console.log(`Audio started playing: ${label}`);
        setIsAudioLoading(false);
        setIsPlaying(true);
        clearTimeout(loadingTimeout);
      });
      
      audio.addEventListener('pause', () => {
        console.log(`Audio paused: ${label}`);
        setIsPlaying(false);
      });
      
      audio.addEventListener('ended', () => {
        console.log(`Audio ended: ${label}`);
        setIsPlaying(false);
        setCurrentTime(0);
      });
      
      // Now set the source and load - AFTER setting up all event handlers
      audio.crossOrigin = "anonymous"; // Add CORS handling
      audio.preload = 'auto';
      
      // Set audio properties
      audio.src = url;
      
      console.log("Loading audio file...");
      audio.load();
      
      // Store the audio element
      setAudioElement(audio);
      
    } catch (error) {
      console.error(`Error creating Audio object for ${label}:`, error);
      setIsAudioLoading(false);
      setIsPlaying(false);
      alert(`Error setting up audio playback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [audioElement, isAudioLoading, currentStopIndex, setAudioData, playbackSpeed]);
  
  // Make these control functions memoized callbacks
  const togglePlayPause = useCallback(() => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play().catch(error => {
        console.error('Error playing audio:', error);
        alert(`Could not play audio: ${error.message}`);
      });
    }
  }, [audioElement, isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioElement) {
      audioElement.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [audioElement]);
  
  // Sort tour POIs by sequence number
  const sortedPois = tour?.tourPois ? [...tour.tourPois].sort((a, b) => a.sequence_number - b.sequence_number) : [];
  // Define currentStop based on sortedPois
  const currentStop = sortedPois[currentStopIndex];
  
  // Audio check - must come after currentStop is defined
  useEffect(() => {
    // Check if currentStop and audioData exist
    if (tour && currentStopIndex >= 0 && currentStopIndex < tour.tourPois.length && Object.keys(audioData).length > 0) {
      const poiId = tour.tourPois[currentStopIndex].poi.id || `poi-${currentStopIndex}`;
      const audioForCurrentStop = audioData[poiId];
      
      console.log("Current stop:", tour.tourPois[currentStopIndex]);
      console.log("Audio data available:", Object.keys(audioData));
      console.log("Audio for current POI:", audioForCurrentStop);
      
      // Check if we need to fetch audio data for this POI
      if (!audioForCurrentStop) {
        console.log("No audio data for current POI, fetching from database...");
        // We could fetch audio data here if necessary
      }
    }
  }, [tour, currentStopIndex, audioData]);
  
  useEffect(() => {
    if (currentStop && audioData) {
      const poiId = currentStop.poi.id || `poi-${currentStopIndex}`;
      console.log("Current POI ID:", poiId);
      console.log("Available audio data keys:", Object.keys(audioData));
      console.log("Has audio for current POI:", !!audioData[poiId]);
      if (audioData[poiId]) {
        console.log("Audio URLs:", audioData[poiId].audioFiles);
      }
    }
  }, [currentStop, currentStopIndex, audioData]);
  
  // Add this useEffect to debug POI data without causing errors
  useEffect(() => {
    // We already have a sortedPois array and currentStopIndex
    const pois = tour?.tourPois || [];
    const sortedPois = [...pois].sort((a, b) => a.sequence_number - b.sequence_number);
    const currentStop = sortedPois[currentStopIndex];
    
    if (currentStop?.poi) {
      logPage('Current POI data:', currentStop.poi);
    }
  }, [tour, currentStopIndex]);
  
  // Add this function to handle playback speed changes
  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (audioElement) {
      audioElement.playbackRate = speed;
      console.log(`Playback speed changed to ${speed}x`);
    }
  }, [audioElement]);

  // Add useEffect for transcript highlighting with sentence-level precision
  useEffect(() => {
    if (isPlaying && duration > 0 && currentTime > 0 && transcriptRef.current) {
      // Calculate how far through the audio we are as a percentage
      const percentComplete = currentTime / duration;
      
      // Get the total length of the transcript text
      const transcriptElement = transcriptRef.current;
      const textContent = transcriptElement.textContent || '';
      const textLength = textContent.length;
      
      // Calculate how many characters should be highlighted based on percentage
      const charsToHighlight = Math.floor(percentComplete * textLength);
      
      // Find which sentence we're currently in
      let sentenceIndex = 0;
      for (let i = 0; i < sentences.length; i++) {
        if (charsToHighlight <= sentences[i].endIndex) {
          sentenceIndex = i;
          break;
        }
        sentenceIndex = i;
      }
      
      // If we're in a new sentence, update the highlight position to end of this sentence
      if (sentenceIndex !== currentSentenceIndex) {
        setCurrentSentenceIndex(sentenceIndex);
      }
      
      // Set highlight position to the end of the current sentence
      const sentenceEndPosition = sentences[sentenceIndex]?.endIndex || charsToHighlight;
      setHighlightPosition(sentenceEndPosition);
    }
  }, [currentTime, duration, isPlaying, sentences, currentSentenceIndex]);

  // Add useEffect to parse sentences when transcript content changes
  useEffect(() => {
    if (currentStop && audioData && currentAudioId) {
      const poiId = currentStop?.poi?.id || `poi-${currentStopIndex}`;
      const content = audioData[poiId]?.content;
      
      if (!content) return;
      
      // Get the appropriate content based on current audio type
      let transcriptText = "";
      if (currentAudioId === 'brief') {
        transcriptText = content.core || content.brief || content.summary || "";
      } else if (currentAudioId === 'detailed') {
        transcriptText = content.secondary || content.detailed || content.medium || "";
      } else {
        transcriptText = content.tertiary || content.in_depth || content.indepth || content.complete || "";
      }
      
      // Split text into sentences and track their end positions
      const sentenceRegex = /[^.!?]+[.!?]+/g;
      const matches = transcriptText.match(sentenceRegex) || [];
      
      let parsedSentences: {text: string, endIndex: number}[] = [];
      let currentIndex = 0;
      
      matches.forEach(sentence => {
        currentIndex += sentence.length;
        parsedSentences.push({
          text: sentence,
          endIndex: currentIndex
        });
      });
      
      // Handle any remaining text that doesn't end with a sentence terminator
      if (currentIndex < transcriptText.length) {
        parsedSentences.push({
          text: transcriptText.slice(currentIndex),
          endIndex: transcriptText.length
        });
      }
      
      setSentences(parsedSentences);
      setCurrentSentenceIndex(0);
      setHighlightPosition(0);
    }
  }, [currentStop, audioData, currentAudioId, currentStopIndex]);
  
  // Create a reference to the client
  const clientRef = useRef<RTVIClient | null>(null);
  
  // Move the useEffect that uses clientRef here after it's declared 
  // Add this useEffect to update the agent when POI changes
  useEffect(() => {
    // No need to update config directly in this effect anymore
    // Instead, we recreate the client with new POI data when the POI changes
    // and can trigger a custom event to notify about the change if the agent is connected
    
    if (!clientRef.current || !currentStop?.poi) return;
    
    console.log(`POI changed to: ${currentStop.poi.name}`); 
    
    // Find our VoiceAgentButton and check if it's connected
    const agentButtonElement = document.querySelector('[data-voice-agent-connected="true"]');
    
    if (agentButtonElement) {
      console.log('Voice agent is connected, sending POI update event');
      
      // Send a custom event to notify about POI change
      setTimeout(() => {
        try {
          // Using a custom event rather than trying to reconfigure the agent directly
          // This will work with our client that's already initialized with the right POI data
          const event = new CustomEvent('user_audio_transcript', {
            detail: { text: `I'd like to know about ${currentStop.poi.name} now` }
          });
          window.dispatchEvent(event);
          console.log('Triggered conversation update for new POI:', currentStop.poi.name);
        } catch (error) {
          console.error('Failed to trigger conversation for new POI:', error);
        }
      }, 1000);
    } else {
      console.log('Voice agent not connected, no need to send update');
    }
  }, [currentStopIndex, currentStop]);
  
  // Create the RTVIClient inside the component to have access to current POI
  const createClient = useCallback(() => {
    console.log('Creating new voice agent client with current POI data');
    
    // Default system prompt for the voice agent
    const DEFAULT_SYSTEM_PROMPT = `You are a helpful, knowledgeable tour guide assistant. 
    You speak in a conversational, friendly tone and keep your answers brief and informative. 
    When you don't know something, you admit it rather than making things up.
    If the user doesn't explicitly ask about a specific place, provide general travel information or assistance.
    When the user asks about a specific location, share interesting facts and information about it based on what you know.
    Do not mention "knowledge base" or "transcripts" in your responses. Just use the information as if it's your own knowledge.
    Your responses will be spoken out loud, so keep them succinct and easy to listen to.`;

    // Get current POI information for the initial prompt
    const currentPoi = currentStop?.poi;
    
    // Combine default prompt with POI information if available
    let initialPrompt = DEFAULT_SYSTEM_PROMPT;
    if (currentPoi) {
      initialPrompt = getAgentPrompt(currentPoi);
      console.log(`Initializing agent with knowledge about: ${currentPoi.name}`);
    }

    // Creating a fresh client with the updated POI information directly in its config
    return new RTVIClient({
      transport: new DailyTransport(),
      params: {
        baseUrl: `/api`,
        requestData: {
          services: {
            stt: "deepgram",
            tts: "cartesia",
            llm: "anthropic",
          },
        },
        endpoints: {
          connect: "/connect",
          action: "/actions",
        },
        config: [
          {
            service: "vad",
            options: [
              {
                name: "params",
                value: {
                  stop_secs: 0.3
                }
              }
            ]
          },
          {
            service: "tts",
            options: [
              {
                name: "voice",
                value: "79a125e8-cd45-4c13-8a67-188112f4dd22"
              },
              {
                name: "language",
                value: "en"
              },
              {
                name: "text_filter",
                value: {
                  filter_code: false,
                  filter_tables: false
                }
              },
              {
                name: "model",
                value: "sonic-english"
              }
            ]
          },
          {
            service: "llm",
            options: [
              {
                name: "model",
                value: "claude-3-7-sonnet-20250219"
              },
              {
                name: "initial_messages",
                value: [
                {
                  role: "system",
                  content: [
                    {
                      type: "text",
                      text: initialPrompt
                    }
                  ]
                }
                ]
              }
            ]
          }
        ],
      }
    });
  }, [currentStop]);
  
  // Create the client when the component mounts or when currentStop changes
  useEffect(() => {
    console.log('RTVIClient effect triggered - handling client lifecycle');
    
    // First disconnect the old client if it exists
    const disconnectClient = async () => {
      if (clientRef.current) {
        try {
          // Only try to disconnect if transport is connected
          console.log('Disconnecting old voice agent client');
          await clientRef.current.disconnect().catch(e => console.error("Error disconnecting old client:", e));
          clientRef.current = null;
        } catch (e) {
          console.error("Failed to disconnect old client:", e);
        }
      }
    };
    
    // Disconnect first, then create a new client
    disconnectClient().then(() => {
      // Create a new client with the current POI information
      clientRef.current = createClient();
      console.log('New voice agent client created');
    });
    
    // Clean up on unmount or before recreation
    return () => {
      disconnectClient().catch(e => console.error("Cleanup error:", e));
    };
  }, [createClient]);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        <p className="mt-4 text-gray-300">Loading tour...</p>
      </div>
    );
  }
  
  if (error || !tour) {
    return (
      <div className="min-h-screen bg-slate-950 p-4">
        <div className="max-w-7xl mx-auto bg-slate-900 rounded-lg shadow-lg border border-purple-900/30 p-6 my-6">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Tour</h1>
          <p className="mb-4 text-gray-300">{error || 'Tour not found'}</p>
          <div className="flex space-x-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded hover:opacity-90 transition-opacity"
            >
              Go Back Home
            </Link>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="px-4 py-2 border border-pink-600 text-pink-400 rounded hover:bg-purple-900/20 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Create a wrapper for the RTVIClientProvider to handle the null case
  const SafeRTVIClientProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    if (!clientRef.current) {
      return <>{children}</>;
    }
    return (
      <RTVIClientProvider client={clientRef.current}>
        {children}
      </RTVIClientProvider>
    );
  };
  
  return (
    <SafeRTVIClientProvider>
      <RTVIClientAudio />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
        {/* Tour Header */}
        <div className="bg-gradient-to-r from-purple-900 via-pink-800 to-orange-900 text-white py-4 shadow-md shadow-purple-900/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">{tour.name}</h1>
                <p className="text-pink-100 mt-1">
                  {tour.tourPois.length} stops • {(tour.total_distance).toFixed(1)} km • {formatDuration(tour.total_duration)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <VoiceAgentButton currentPoi={currentStop?.poi} clientRef={clientRef} />
                <Link
                  href="/"
                  className="text-white hover:text-pink-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Audio Guide Generation Button - Parent level control */}
          {/* This section is removed as requested */}
          
          {/* Generation Progress Indicator */}
          {isGeneratingAudio && (
            <div className="bg-slate-900/80 p-4 rounded-lg shadow-lg border border-purple-900/30 mb-8">
              <h3 className="font-semibold text-lg mb-3 flex items-center text-white">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Audio Guides
              </h3>
              <div className="w-full bg-slate-800 rounded-full h-2.5 mb-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 h-2.5 rounded-full transition-all" 
                  style={{ width: `${generationProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-pink-200">{currentGenerationStep}</p>
              <p className="text-sm text-gray-400 mt-1">This may take a few minutes. Please don't close this page.</p>
            </div>
          )}
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="bg-slate-800 rounded-full h-2.5 mb-2">
              <div 
                className="bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 h-2.5 rounded-full" 
                style={{ width: `${(currentStopIndex / Math.max(1, tour.tourPois.length - 1)) * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Start</span>
              <span>Finish</span>
            </div>
          </div>
          
          {/* Current Stop */}
          {currentStop && (
            <div className="bg-slate-900/80 rounded-lg shadow-lg border border-purple-900/30 overflow-hidden mb-6">
              <div className="p-4 border-b border-purple-900/30">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-white">
                    Stop {currentStopIndex + 1}: {currentStop.poi.name}
                  </h2>
                  <span className="bg-purple-900/50 text-pink-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-purple-700/50">
                    {currentStopIndex + 1}/{sortedPois.length}
                  </span>
                </div>
                
                <p className="text-gray-400 mt-1">{currentStop.poi.formatted_address}</p>
                
                {/* Add website link if available */}
                {currentStop.poi.website && (
                  <div className="mt-2">
                    <a 
                      href={currentStop.poi.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-pink-400 hover:text-pink-300"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Visit Website
                    </a>
                  </div>
                )}
                
                {currentStop.poi.rating && (
                  <div className="flex items-center mt-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg 
                          key={i}
                          className={`w-4 h-4 ${i < Math.round(currentStop.poi.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-gray-500 ml-1">{currentStop.poi.rating}</span>
                  </div>
                )}
              </div>
              
              {/* Placeholder for POI Image */}
              <div className="h-64 bg-slate-800 flex items-center justify-center">
                {currentStop.poi.thumbnail_url ? (
                  <POIImage 
                    imagePath={currentStop.poi.thumbnail_url} 
                    attribution={currentStop.poi.image_attribution || null}
                    altText={currentStop.poi.name}
                  />
                ) : currentStop.poi.photo_references && currentStop.poi.photo_references.length > 0 ? (
                  <img 
                    src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${currentStop.poi.photo_references[0]}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                    alt={currentStop.poi.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              
              {/* Content Section */}
              <div className="p-4">
                <h3 className="text-lg font-medium text-white mb-2">About this location</h3>
                <p className="text-gray-300 mb-4">
                  {Object.keys(audioData).length > 0 ? 
                    "Audio guides for this location are ready to play below." : 
                    "Audio guide content for this location will be generated and displayed here."}
                </p>
                
                {/* Enhanced Audio Player Section */}
                {Object.keys(audioData).length > 0 ? (
                  <>
                    {audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`] ? (
                      <div className="bg-slate-800/80 p-4 rounded-lg mb-4 shadow-md border border-purple-900/30">
                        <div className="flex flex-col space-y-4">
                          {/* Audio selection buttons */}
                          <div className="flex flex-wrap gap-2">
                            <button 
                              className={`${currentAudioId === 'brief' ? 'bg-gradient-to-r from-orange-600 to-pink-700' : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90'} text-white py-2 px-3 rounded-md flex items-center justify-center ${isAudioLoading && currentAudioId === 'brief' ? 'opacity-75 cursor-wait' : ''} shadow-md`}
                              onClick={async () => {
                                setCurrentAudioId('brief');
                                const audioUrl = audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.audioFiles?.coreAudioUrl;
                                console.log("Brief audio URL:", audioUrl);
                                if (!audioUrl) {
                                  alert("No brief audio available. Try regenerating the audio guides.");
                                  return;
                                }
                                await playAudio(audioUrl, "Brief Overview");
                              }}
                              disabled={isAudioLoading}
                            >
                              {isAudioLoading && currentAudioId === 'brief' ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                  </svg>
                                  Brief Overview (30-60s)
                                </>
                              )}
                            </button>
                            
                            <button 
                              className={`${currentAudioId === 'detailed' ? 'bg-gradient-to-r from-orange-600 to-pink-700' : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90'} text-white py-2 px-3 rounded-md flex items-center justify-center ${isAudioLoading && currentAudioId === 'detailed' ? 'opacity-75 cursor-wait' : ''} shadow-md`}
                              onClick={async () => {
                                setCurrentAudioId('detailed');
                                const audioUrl = audioData[currentStop.poi.id || `poi-${currentStopIndex}`]?.audioFiles?.secondaryAudioUrl;
                                console.log("Detailed audio URL:", audioUrl);
                                if (!audioUrl) {
                                  alert("No detailed audio available. Try regenerating the audio guides.");
                                  return;
                                }
                                await playAudio(audioUrl, "Detailed Guide");
                              }}
                              disabled={isAudioLoading}
                            >
                              {isAudioLoading && currentAudioId === 'detailed' ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                  </svg>
                                  Detailed Guide (1-2 min)
                                </>
                              )}
                            </button>
                            
                            <button 
                              className={`${currentAudioId === 'in-depth' ? 'bg-gradient-to-r from-orange-600 to-pink-700' : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90'} text-white py-2 px-3 rounded-md flex items-center justify-center ${isAudioLoading && currentAudioId === 'in-depth' ? 'opacity-75 cursor-wait' : ''} shadow-md`}
                              onClick={async () => {
                                setCurrentAudioId('in-depth');
                                const audioUrl = audioData[currentStop.poi.id || `poi-${currentStopIndex}`]?.audioFiles?.tertiaryAudioUrl;
                                console.log("In-depth audio URL:", audioUrl);
                                if (!audioUrl) {
                                  alert("No in-depth audio available. Try regenerating the audio guides.");
                                  return;
                                }
                                await playAudio(audioUrl, "In-Depth Exploration");
                              }}
                              disabled={isAudioLoading}
                            >
                              {isAudioLoading && currentAudioId === 'in-depth' ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                  </svg>
                                  In-Depth Exploration (3+ min)
                                </>
                              )}
                            </button>
                          </div>
                          
                          {/* Audio player controls */}
                          {activeAudioUrl && (
                            <div className="mt-4 bg-slate-800 p-3 rounded-lg shadow-md border border-purple-900/30">
                              {/* Play/Pause button and time indicator */}
                              <div className="flex items-center justify-between mb-2">
                                <button 
                                  onClick={togglePlayPause} 
                                  className="bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90 text-white p-2 rounded-full shadow-md"
                                  disabled={isAudioLoading}
                                >
                                  {isAudioLoading ? (
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : isPlaying ? (
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                                <div className="text-sm font-medium text-gray-300">
                                  {formatTime(currentTime)} / {formatTime(duration)}
                                </div>
                              </div>
                              
                              {/* Scrubber (progress bar) */}
                              <div className="w-full mb-3">
                                <input
                                  type="range"
                                  min="0"
                                  max={duration || 0}
                                  value={currentTime}
                                  onChange={handleSeek}
                                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                  disabled={!duration || isAudioLoading}
                                />
                              </div>
                              
                              {/* Simplified playback speed control */}
                              <div className="flex items-center justify-end mb-3">
                                <div className="flex items-center">
                                  <div className="flex items-center mr-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs text-gray-400">Speed</span>
                                  </div>
                                  
                                  {/* Compact slider for playback speed */}
                                  <div className="w-20 mx-2">
                                    <input
                                      type="range"
                                      min="0.25"
                                      max="3"
                                      step="0.05"
                                      value={playbackSpeed}
                                      onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                    />
                                  </div>
                                  
                                  {/* Display current speed value */}
                                  <div className="min-w-[45px] px-2 py-0.5 text-center text-xs font-medium rounded-md bg-slate-700 text-pink-300">
                                    {playbackSpeed.toFixed(2)}x
                                  </div>
                                </div>
                              </div>
                              
                              {/* Transcript toggle button */}
                              <div className="flex justify-end">
                                <button
                                  onClick={() => {
                                    console.log("Toggle transcript clicked, current state:", showTranscript);
                                    setShowTranscript(!showTranscript);
                                  }}
                                  className="text-xs flex items-center px-2 py-1 rounded bg-slate-700 text-pink-400 hover:text-pink-300 hover:bg-slate-600 transition-colors"
                                >
                                  {showTranscript ? (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7 7 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Hide Transcript
                                    </>
                                  ) : (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7 7 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      Show Transcript
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/80 p-4 rounded-lg flex items-center justify-between mb-4 border border-purple-900/30 shadow-md">
                        <div className="flex items-center">
                          <button className="bg-pink-500 text-white rounded-full p-2 mr-3 opacity-50 cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3-2a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <div>
                            <p className="font-medium text-white">Audio Guide</p>
                            <p className="text-sm text-gray-300">Generate audio guides using the button at the top</p>
                          </div>
                        </div>
                        <div className="text-gray-300">--:--</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-slate-800/80 p-4 rounded-lg flex items-center justify-between mb-4 border border-purple-900/30 shadow-md">
                    <div className="flex items-center">
                      <button className="bg-pink-500 text-white rounded-full p-2 mr-3 opacity-50 cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3-2a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <div>
                        <p className="font-medium text-white">Audio Guide</p>
                        <p className="text-sm text-gray-300">Generate audio guides using the button at the top</p>
                      </div>
                    </div>
                    <div className="text-gray-300">--:--</div>
                  </div>
                )}
                
                {/* Google Maps Link */}
                <a 
                  href={getGoogleMapsUrl(currentStop.poi)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-pink-400 hover:text-pink-300 inline-flex items-center mb-4"
                >
                  <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  View in Google Maps
                </a>
              </div>
            </div>
          )}
          
          {/* Transcript display */}
          {showTranscript && currentAudioId && activeAudioUrl && audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.content && (
            <div className="mt-4 bg-slate-800 p-4 rounded-lg shadow-md border-l-4 border-pink-500">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <h4 className="text-sm font-medium text-white">Transcript</h4>
                  {audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.language && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-900/50 text-pink-300 text-xs font-medium rounded-full border border-purple-700/50">
                      {audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`].language.toUpperCase()}
                    </span>
                  )}
                  
                  {/* Show translation status */}
                  {audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`]?.translationInProgress && (
                    <span className="ml-2 px-2 py-0.5 bg-amber-900/40 text-amber-300 text-xs font-medium rounded-full flex items-center border border-amber-700/50">
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Translating...
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => setShowTranscript(false)}
                  className="text-gray-400 hover:text-pink-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div 
                ref={transcriptRef}
                className="prose prose-sm max-w-none text-gray-300 prose-headings:text-pink-300 prose-strong:text-pink-200 prose-a:text-pink-400 relative"
              >
                {(() => {
                  const poiData = audioData[currentStop?.poi?.id || `poi-${currentStopIndex}`];
                  const content = poiData?.content;
                  
                  // Check if content exists
                  if (!content) return "No transcript available.";
                  
                  // Try multiple possible property names for content
                  let transcriptText = "";
                  if (currentAudioId === 'brief') {
                    transcriptText = content.core || content.brief || content.summary || "No brief transcript available.";
                  } else if (currentAudioId === 'detailed') {
                    transcriptText = content.secondary || content.detailed || content.medium || "No detailed transcript available.";
                  } else {
                    transcriptText = content.tertiary || content.in_depth || content.indepth || content.complete || "No in-depth transcript available.";
                  }
                  
                  // Return the highlighted transcript
                  if (typeof transcriptText === 'string') {
                    const highlighted = transcriptText.substring(0, highlightPosition);
                    const remaining = transcriptText.substring(highlightPosition);
                    
                    return (
                      <>
                        <span className="text-pink-300">{highlighted}</span>
                        <span>{remaining}</span>
                      </>
                    );
                  }
                  
                  return transcriptText;
                })()}
              </div>
            </div>
          )}
          
          {/* Navigation Controls */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => goToStop(currentStopIndex - 1)}
              className={`flex items-center px-4 py-2 rounded-md ${
                currentStopIndex > 0 
                  ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white hover:opacity-90 shadow-md' 
                  : 'bg-slate-800 text-gray-500 cursor-not-allowed'
              }`}
              disabled={currentStopIndex === 0}
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous Stop
            </button>
            
            <button
              onClick={() => goToStop(currentStopIndex + 1)}
              className={`flex items-center px-4 py-2 rounded-md ${
                currentStopIndex < sortedPois.length - 1 
                  ? 'bg-gradient-to-r from-orange-500 to-pink-600 text-white hover:opacity-90 shadow-md' 
                  : 'bg-slate-800 text-gray-500 cursor-not-allowed'
              }`}
              disabled={currentStopIndex === sortedPois.length - 1}
            >
              Next Stop
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </SafeRTVIClientProvider>
  );
} 