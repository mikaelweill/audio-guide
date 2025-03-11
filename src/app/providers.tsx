'use client'

import { LanguageProvider } from '@/context/LanguageContext';
import { TranscriptModalProvider } from '@/context/TranscriptModalContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TranscriptModalProvider>
        {children}
      </TranscriptModalProvider>
    </LanguageProvider>
  )
} 