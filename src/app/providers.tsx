'use client'

import { LanguageProvider } from '@/context/LanguageContext';
import { TranscriptModalProvider } from '@/context/TranscriptModalContext';
import { AgentProvider } from '@/context/AgentContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TranscriptModalProvider>
        <AgentProvider>
          {children}
        </AgentProvider>
      </TranscriptModalProvider>
    </LanguageProvider>
  )
} 