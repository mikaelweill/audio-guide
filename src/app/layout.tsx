import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import { AuthProvider } from "@/context/AuthContext";
import AuthStatus from "@/components/Layout/AuthStatus";
import DebugPanel from "@/components/Layout/DebugPanel";
import { Toaster } from 'react-hot-toast';
import { Providers } from "./providers";
import OfflineDetector from "@/components/OfflineDetector";

// Client-side component to load offline navigation
const OfflineNavigationWrapper = () => {
  'use client';
  
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Dynamically import the OfflineNavigation component
  const OfflineNavigation = require('@/components/OfflineNavigation').default;
  return <OfflineNavigation />;
};

// Client-side component to load offline emergency access
const EmergencyAccessWrapper = () => {
  'use client';
  
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Dynamically import the OfflineEmergencyAccess component
  const OfflineEmergencyAccess = require('@/components/OfflineEmergencyAccess').default;
  return <OfflineEmergencyAccess />;
};

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Audio Travel Guide",
  description: "Personalized location-based audio guided tours",
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
  themeColor: '#f97316',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Audio Guide',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/earth-globe-global-svgrepo-com.svg" />
        <script 
          dangerouslySetInnerHTML={{
            __html: `
              // Check if any workers need to be unregistered
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  const currentCache = localStorage.getItem('sw-cache-version');
                  const expectedVersion = '1.0.1'; // Increment this when service worker needs refresh

                  if (currentCache !== expectedVersion) {
                    // Unregister all service workers and clear indexedDB if version mismatch
                    for(let registration of registrations) {
                      registration.unregister();
                      console.log('Unregistered old service worker');
                    }
                    
                    // Clear any problematic IndexedDB databases
                    if (window.indexedDB) {
                      window.indexedDB.deleteDatabase('offline-audio-guide');
                      console.log('Cleared offline-audio-guide database');
                    }
                    
                    // Update cache version
                    localStorage.setItem('sw-cache-version', expectedVersion);
                    
                    // Force page reload after cleanup
                    window.location.reload();
                  }
                });
              }
            `
          }}
        />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <AuthProvider>
          <Providers>
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <AuthStatus />
            {process.env.NODE_ENV === "development" && <DebugPanel />}
            <Toaster position="bottom-right" />
            <OfflineDetector />
            <OfflineNavigationWrapper />
            <EmergencyAccessWrapper />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
