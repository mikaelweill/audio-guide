'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TranscriptModalContextType {
  isOpen: boolean;
  transcript: string;
  title: string;
  language?: string;
  translationInProgress?: boolean;
  openModal: (transcript: string, title: string, language?: string, translationInProgress?: boolean) => void;
  closeModal: () => void;
}

const TranscriptModalContext = createContext<TranscriptModalContextType | undefined>(undefined);

export function TranscriptModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [translationInProgress, setTranslationInProgress] = useState<boolean | undefined>(undefined);

  const openModal = (
    newTranscript: string, 
    newTitle: string, 
    newLanguage?: string,
    newTranslationInProgress?: boolean
  ) => {
    setTranscript(newTranscript);
    setTitle(newTitle);
    setLanguage(newLanguage);
    setTranslationInProgress(newTranslationInProgress);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <TranscriptModalContext.Provider
      value={{ 
        isOpen, 
        transcript, 
        title, 
        language,
        translationInProgress,
        openModal, 
        closeModal 
      }}
    >
      {children}
    </TranscriptModalContext.Provider>
  );
}

export function useTranscriptModal() {
  const context = useContext(TranscriptModalContext);
  
  if (context === undefined) {
    throw new Error('useTranscriptModal must be used within a TranscriptModalProvider');
  }
  
  return context;
} 