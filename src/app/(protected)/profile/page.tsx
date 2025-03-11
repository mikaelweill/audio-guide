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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/40 to-navy-950 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 right-0 w-64 h-64 bg-orange-500/10 rounded-full -translate-y-1/4 translate-x-1/4 blur-3xl"></div>
      <div className="absolute bottom-20 left-0 w-80 h-80 bg-pink-500/10 rounded-full translate-y-1/4 -translate-x-1/4 blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 bg-gradient-radial from-purple-900/5 to-transparent opacity-30"></div>
      {/* Subtle stars */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute h-1 w-1 bg-white/70 rounded-full top-[10%] left-[15%] animate-pulse" style={{ animationDuration: '3s' }}></div>
        <div className="absolute h-1 w-1 bg-white/60 rounded-full top-[20%] left-[40%] animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute h-1 w-1 bg-white/60 rounded-full top-[15%] left-[70%] animate-pulse" style={{ animationDuration: '5s' }}></div>
        <div className="absolute h-1 w-1 bg-white/70 rounded-full top-[60%] left-[85%] animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute h-1 w-1 bg-white/60 rounded-full top-[80%] left-[20%] animate-pulse" style={{ animationDuration: '3s' }}></div>
        <div className="absolute h-[2px] w-[2px] bg-white/80 rounded-full top-[35%] left-[55%] animate-pulse" style={{ animationDuration: '2s' }}></div>
        <div className="absolute h-[2px] w-[2px] bg-white/80 rounded-full top-[75%] left-[65%] animate-pulse" style={{ animationDuration: '6s' }}></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <h1 className="text-2xl font-bold mb-6 text-white flex items-center">
          <span className="w-1 h-6 bg-gradient-to-b from-orange-400 to-pink-500 rounded-full mr-2 inline-block"></span>
          Your Profile
        </h1>
        
        <div className="bg-slate-900/80 border border-purple-900/50 shadow-lg shadow-purple-900/20 rounded-lg p-6 mb-6 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-orange-50 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            User Information
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-purple-200/70">Email</p>
              <p className="font-medium text-white">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-purple-200/70">Account ID</p>
              <p className="font-mono text-sm text-purple-100/90">{user?.id}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900/80 border border-purple-900/50 shadow-lg shadow-purple-900/20 rounded-lg p-6 mb-6 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute h-1 top-0 left-0 right-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"></div>
          <div className="absolute -right-16 -top-16 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
          <h2 className="text-xl font-semibold mb-4 text-orange-50 flex items-center relative z-10">
            <svg className="w-5 h-5 mr-2 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8h10M5 12h4"></path>
              <circle cx="15" cy="12" r="1"></circle>
              <path d="M2 22l3-3H18a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14"></path>
            </svg>
            Language Preferences
          </h2>
          <p className="text-purple-100/90 mb-4 relative z-10">
            Choose your preferred language for audio guides and content. 
            When available, audio guides will play in your selected language.
          </p>
          
          {isLoading ? (
            <div className="py-4 flex items-center text-purple-100/80">
              <div className="w-5 h-5 border-2 border-t-orange-500 border-r-transparent border-b-pink-500 border-l-transparent rounded-full animate-spin mr-3"></div>
              <span>Loading preferences...</span>
            </div>
          ) : (
            <div className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLocalLanguage(lang.code as LanguageCode)}
                    className={`
                      relative p-4 border rounded-lg flex flex-col items-center justify-center transition-all
                      ${localLanguage === lang.code 
                        ? 'border-orange-500/70 bg-gradient-to-br from-orange-900/30 to-pink-900/30 shadow-md shadow-orange-900/40' 
                        : 'border-purple-800/50 hover:border-pink-700/50 hover:bg-pink-900/20'
                      }
                    `}
                  >
                    {localLanguage === lang.code && (
                      <div className="absolute top-2 right-2 h-3 w-3 bg-orange-500 rounded-full"></div>
                    )}
                    <span className="text-2xl mb-2" role="img" aria-label={lang.name}>
                      {LANGUAGE_FLAGS[lang.code]}
                    </span>
                    <span className="font-medium text-white">{lang.name}</span>
                  </button>
                ))}
              </div>
              
              <div className="pt-4 border-t border-purple-800/50">
                <button
                  onClick={saveLanguagePreference}
                  disabled={isSaving || !languageChanged}
                  className={`
                    inline-flex justify-center items-center py-2 px-4 border border-transparent 
                    shadow-sm text-sm font-medium rounded-md text-white 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500
                    ${isSaving 
                      ? 'bg-orange-700/70 cursor-not-allowed' 
                      : languageChanged 
                        ? 'bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 shadow-lg shadow-orange-900/30' 
                        : 'bg-slate-600/50 cursor-not-allowed'
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
                  <p className="mt-2 text-sm text-orange-300">
                    <span className="inline-flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      You have unsaved changes
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 bg-slate-900/80 border border-purple-900/50 shadow-lg shadow-purple-900/20 rounded-lg p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl"></div>
          <h2 className="text-xl font-semibold mb-4 text-orange-50 flex items-center relative z-10">
            <svg className="w-5 h-5 mr-2 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Language Support Information
          </h2>
          <div className="prose prose-invert max-w-none relative z-10">
            <p className="text-purple-100/90">
              Our audio guide supports multiple languages for a personalized experience.
              We currently offer:
            </p>
            <ul className="mt-2 space-y-1 text-purple-100/90 list-disc pl-5">
              <li>Audio playback in your preferred language (when available)</li>
              <li>Transcripts in multiple languages</li>
              <li>Tour information localized to your language</li>
            </ul>
            <p className="mt-4 text-sm text-purple-200/70">
              Note: Some locations may have limited language support. In those cases, English will be used as a fallback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 