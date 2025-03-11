'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, LanguageCode } from '@/context/LanguageContext';
import toast from 'react-hot-toast';

// Supported languages based on the translation plan
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' }
];

// Language flag icons
const LANGUAGE_FLAGS: Record<string, string> = {
  'en': '🇺🇸',
  'es': '🇪🇸',
  'fr': '🇫🇷',
  'de': '🇩🇪',
  'ja': '🇯🇵'
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { language, setLanguage, isLoading } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [localLanguage, setLocalLanguage] = useState<LanguageCode>(language);

  // Update local state when the language context changes
  useEffect(() => {
    setLocalLanguage(language);
  }, [language]);

  // Save language preference using the context
  const saveLanguagePreference = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      await setLanguage(localLanguage);
      toast.success('Language preference saved successfully!');
    } catch (error) {
      console.error('Error saving language preference:', error);
      toast.error('Failed to save language preference. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const languageChanged = localLanguage !== language;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Account ID</p>
            <p className="font-mono text-sm">{user?.id}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Language Preferences</h2>
        <p className="text-gray-600 mb-4">
          Choose your preferred language for audio guides and content. 
          When available, audio guides will play in your selected language.
        </p>
        
        {isLoading ? (
          <div className="py-4 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
            <span>Loading preferences...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLocalLanguage(lang.code as LanguageCode)}
                  className={`
                    relative p-4 border rounded-lg flex flex-col items-center justify-center transition-all
                    ${localLanguage === lang.code 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }
                  `}
                >
                  {localLanguage === lang.code && (
                    <div className="absolute top-2 right-2 h-3 w-3 bg-blue-500 rounded-full"></div>
                  )}
                  <span className="text-2xl mb-2" role="img" aria-label={lang.name}>
                    {LANGUAGE_FLAGS[lang.code]}
                  </span>
                  <span className="font-medium">{lang.name}</span>
                </button>
              ))}
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={saveLanguagePreference}
                disabled={isSaving || !languageChanged}
                className={`
                  inline-flex justify-center items-center py-2 px-4 border border-transparent 
                  shadow-sm text-sm font-medium rounded-md text-white 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  ${isSaving 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : languageChanged 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isSaving && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </button>
              
              {languageChanged && (
                <p className="mt-2 text-sm text-blue-600">
                  You have unsaved changes
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Language Support Information</h2>
        <div className="prose max-w-none">
          <p>
            Our audio guide supports multiple languages for a personalized experience.
            We currently offer:
          </p>
          <ul className="mt-2 space-y-1">
            <li>Audio playback in your preferred language (when available)</li>
            <li>Transcripts in multiple languages</li>
            <li>Tour information localized to your language</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            Note: Some locations may have limited language support. In those cases, English will be used as a fallback.
          </p>
        </div>
      </div>
    </div>
  );
} 