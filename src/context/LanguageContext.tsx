'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@/utils/supabase/client';

// Define the supported languages
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ja';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  // Load user's language preference from User table
  useEffect(() => {
    async function loadUserLanguagePreference() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('User')
          .select('preferred_language')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error loading language preference:', error);
        } else if (data && data.preferred_language) {
          setLanguageState(data.preferred_language as LanguageCode);
        }
      } catch (error) {
        console.error('Error in language preference loading:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserLanguagePreference();
  }, [user, supabase]);

  // Function to update the language preference
  const setLanguage = async (newLanguage: LanguageCode) => {
    setLanguageState(newLanguage);

    // If user is logged in, save their preference to the database
    if (user) {
      try {
        const { error } = await supabase
          .from('User')
          .update({
            preferred_language: newLanguage
          })
          .eq('id', user.id);

        if (error) {
          console.error('Error saving language preference:', error);
        }
      } catch (error) {
        console.error('Error in language preference saving:', error);
      }
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
} 