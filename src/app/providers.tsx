'use client'

import { LanguageProvider } from '@/context/LanguageContext';
import { TranscriptModalProvider } from '@/context/TranscriptModalContext';
import { AgentProvider } from '@/context/AgentContext';
import OfflineDetector from '@/components/OfflineDetector';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TranscriptModalProvider>
        <AgentProvider>
          {children}
          <OfflineDetector />
        </AgentProvider>
      </TranscriptModalProvider>
    </LanguageProvider>
  )
} 