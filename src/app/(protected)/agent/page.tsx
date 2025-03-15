"use client";

import { useState, useEffect } from "react";
import { RTVIClient } from "@pipecat-ai/client-js";
import { DailyTransport } from "@pipecat-ai/daily-transport";
import { RTVIClientAudio, RTVIClientProvider } from "@pipecat-ai/client-react";
import AgentChat from "./AgentChat";

export default function AgentPage() {
  const [voiceClient, setVoiceClient] = useState<RTVIClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (voiceClient) {
      return;
    }

    try {
      const newVoiceClient = new RTVIClient({
        transport: new DailyTransport(),
        params: {
          baseUrl: `/api`,
          requestData: {
            services: {
              stt: "deepgram",
              tts: "cartesia",
              llm: "gemini",
            },
            api_keys: {
              gemini: process.env.GEMINI_API_KEY
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
                  value: "gemini-1.5-pro"
                },
                {
                  name: "initial_messages",
                  value: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "I want you to act as a tour guide. You are enthusiastic, knowledgeable, and helpful. Keep your responses brief and conversational, as they will be spoken out loud. Start by briefly introducing yourself as a tour guide assistant. Your responses will be converted to audio, so speak naturally."
                        }
                      ]
                    }
                  ]
                },
                {
                  name: "temperature",
                  value: 0.7
                },
                {
                  name: "run_on_config",
                  value: true
                }
              ]
            }
          ],
        },
      });

      newVoiceClient.on('error', (error) => {
        console.error('RTVIClient error:', error);
        setError(`Error: ${error.message || 'Unknown error'}`);
      });
      
      newVoiceClient.on('transportStateChanged', (state) => {
        console.log('Transport state changed:', state);
      });

      setVoiceClient(newVoiceClient);
    } catch (err: any) {
      console.error('Error creating voice client:', err);
      setError(err.message || 'Failed to create voice client');
    }
  }, [voiceClient]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-8">Tour Guide Assistant</h1>
      {error && (
        <div className="p-4 mb-4 bg-red-500/20 border border-red-500/50 rounded-md text-red-200">
          {error}
        </div>
      )}
      {voiceClient ? (
        <RTVIClientProvider client={voiceClient}>
          <>
            <AgentChat />
            <RTVIClientAudio />
          </>
        </RTVIClientProvider>
      ) : (
        <div>Loading voice client...</div>
      )}
    </div>
  );
} 