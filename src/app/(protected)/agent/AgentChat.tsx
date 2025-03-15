"use client";

import { useState, useCallback } from "react";
import {
  TransportState,
  RTVIError,
  RTVIEvent
} from "@pipecat-ai/client-js";
import { useRTVIClient, useRTVIClientEvent } from "@pipecat-ai/client-react";

// Custom interface for our transcript data
interface CustomTranscriptData {
  text: string;
  timestamp: number;
  isBot: boolean;
}

const AgentChat = () => {
  const voiceClient = useRTVIClient();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TransportState>("disconnected");
  const [transcripts, setTranscripts] = useState<CustomTranscriptData[]>([]);

  // Listen for bot transcript updates
  useRTVIClientEvent(
    // @ts-ignore - There seems to be type inconsistencies in the package
    "bot_llm_text",
    useCallback(
      (data: { text: string }) => {
        setTranscripts((prev) => [
          ...prev,
          {
            text: data.text,
            timestamp: Date.now(),
            isBot: true
          }
        ]);
      },
      [setTranscripts]
    )
  );

  // Listen for user transcript updates
  useRTVIClientEvent(
    // @ts-ignore - There seems to be type inconsistencies in the package
    "user_transcript",
    useCallback(
      (data: { text: string }) => {
        setTranscripts((prev) => [
          ...prev,
          {
            text: data.text,
            timestamp: Date.now(),
            isBot: false
          }
        ]);
      },
      [setTranscripts]
    )
  );

  // Listen for transport state changes
  useRTVIClientEvent(
    RTVIEvent.TransportStateChanged,
    (state: TransportState) => {
      setState(state);
    }
  );

  // Connect to the bot
  const connect = async () => {
    if (!voiceClient) return;

    try {
      await voiceClient.connect();
    } catch (e) {
      setError((e as RTVIError).message || "Unknown error occurred");
      voiceClient.disconnect();
    }
  };

  // Disconnect from the bot
  const disconnect = async () => {
    if (!voiceClient) return;
    await voiceClient.disconnect();
    setTranscripts([]);
  };

  // Clear transcripts
  const clearTranscripts = () => {
    setTranscripts([]);
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 bg-white shadow-lg rounded-lg p-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-4">
        <button
          onClick={state === "disconnected" ? connect : disconnect}
          className={`px-5 py-2 rounded-full font-medium ${
            state === "disconnected"
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          {state === "disconnected" ? "Start Conversation" : "End Conversation"}
        </button>

        {state !== "disconnected" && (
          <button
            onClick={clearTranscripts}
            className="px-5 py-2 rounded-full bg-gray-200 hover:bg-gray-300 font-medium"
          >
            Clear Chat
          </button>
        )}
      </div>

      <div className="text-center text-sm text-gray-500">
        Status: <span className="font-medium">{state}</span>
      </div>

      {transcripts.length > 0 && (
        <div className="mt-6 border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h2 className="font-medium">Conversation</h2>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto space-y-4">
            {/* Sort transcripts by timestamp */}
            {[...transcripts]
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((transcript, index) => (
                <div
                  key={index}
                  className={`flex ${
                    transcript.isBot ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm md:max-w-md rounded-lg px-4 py-2 ${
                      transcript.isBot
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    <div className="text-xs font-medium mb-1">
                      {transcript.isBot ? "Assistant" : "You"}
                    </div>
                    <div>{transcript.text}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {state !== "disconnected" && (
        <div className="text-center text-sm text-gray-500 mt-4">
          Microphone is active. Start speaking to interact with the assistant.
        </div>
      )}
    </div>
  );
};

export default AgentChat; 