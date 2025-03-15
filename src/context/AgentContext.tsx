"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PoiKnowledge {
  id: string;
  name: string;
  description: string;
  facts: string[];
  history?: string;
  culturalSignificance?: string;
}

interface AgentContextType {
  currentPoi: PoiKnowledge | null;
  setCurrentPoi: (poi: PoiKnowledge | null) => void;
  isAgentReady: boolean;
  setIsAgentReady: (ready: boolean) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [currentPoi, setCurrentPoi] = useState<PoiKnowledge | null>(null);
  const [isAgentReady, setIsAgentReady] = useState<boolean>(false);

  return (
    <AgentContext.Provider
      value={{
        currentPoi,
        setCurrentPoi,
        isAgentReady,
        setIsAgentReady
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
} 