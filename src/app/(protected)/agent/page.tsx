"use client";

import { useState, useEffect } from "react";
import { RTVIClient } from "@pipecat-ai/client-js";
import { DailyTransport } from "@pipecat-ai/daily-transport";
import { RTVIClientAudio, RTVIClientProvider } from "@pipecat-ai/client-react";
import AgentChat from "./AgentChat";

export default function AgentPage() {
  const [voiceClient, setVoiceClient] = useState<RTVIClient | null>(null);

  useEffect(() => {
    if (voiceClient) {
      return;
    }

    const newVoiceClient = new RTVIClient({
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
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "You are an AI tour guide assistant. You are enthusiastic, knowledgeable, and helpful. Keep your responses brief and conversational, as they will be spoken out loud. Start by briefly introducing yourself as a tour guide assistant. Your responses will be converted to audio, so speak naturally."
                      }
                    ]
                  }
                ]
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

    setVoiceClient(newVoiceClient);
  }, [voiceClient]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-8">Tour Guide Assistant</h1>
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