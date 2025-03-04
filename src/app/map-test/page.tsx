'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function MapTest() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapStatus, setMapStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    // Check if the Google Maps script is already loaded
    if (!window.google || !window.google.maps) {
      console.log("Loading Google Maps script...");
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      console.log("API Key exists:", !!apiKey);
      
      if (!apiKey) {
        setMapStatus('error');
        setErrorDetails('API key is missing in environment variables');
        return;
      }
      
      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      // Set up error handling for the script
      script.onerror = () => {
        console.error("Failed to load Google Maps script");
        setMapStatus('error');
        setErrorDetails('Failed to load Google Maps script - check your API key and network connection');
      };
      
      // Define the callback function
      window.initMap = function() {
        try {
          if (mapRef.current) {
            console.log("Initializing map...");
            new window.google.maps.Map(mapRef.current, {
              center: { lat: 40.7128, lng: -74.0060 }, // New York
              zoom: 12,
            });
            console.log("Map initialized successfully!");
            setMapStatus('success');
          }
        } catch (e) {
          console.error("Error initializing map:", e);
          setMapStatus('error');
          setErrorDetails(`Error initializing map: ${e instanceof Error ? e.message : String(e)}`);
        }
      };
      
      // Add the script to the document
      document.head.appendChild(script);
      
      // Clean up
      return () => {
        // Only try to remove if it was actually added
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        // Use optional chaining to avoid TypeScript error
        window.initMap = undefined;
      };
    } else if (mapRef.current) {
      // Google Maps is already loaded
      try {
        new window.google.maps.Map(mapRef.current, {
          center: { lat: 40.7128, lng: -74.0060 }, // New York
          zoom: 12,
        });
        setMapStatus('success');
      } catch (e) {
        console.error("Error initializing map with existing Google Maps:", e);
        setMapStatus('error');
        setErrorDetails(`Error with existing Google Maps: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }, []);

  return (
    <div className="flex flex-col items-center p-8">
      <h1 className="text-2xl font-bold mb-6">Google Maps Test Page</h1>
      
      <div className="bg-gray-100 p-4 mb-6 max-w-lg w-full">
        <p className="mb-2">Status: 
          <span className={`font-semibold ml-2 ${
            mapStatus === 'loading' ? 'text-yellow-600' : 
            mapStatus === 'success' ? 'text-green-600' : 
            'text-red-600'
          }`}>
            {mapStatus === 'loading' ? 'Loading...' : 
             mapStatus === 'success' ? 'Success! Map loaded correctly.' : 
             'Error loading map'}
          </span>
        </p>
        
        {mapStatus === 'error' && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700 font-medium">Error Details:</p>
            <p className="text-red-600">{errorDetails}</p>
          </div>
        )}
        
        <h2 className="font-bold mt-4 mb-2">Quick Fix Steps:</h2>
        <ol className="list-decimal pl-6">
          <li>Ensure you've enabled <b>Maps JavaScript API</b> in Google Cloud Console</li>
          <li><b>Set up a billing account</b> in Google Cloud (required, even for free tier)</li>
          <li>Check API key restrictions to allow <code>localhost</code></li>
          <li>Wait a few minutes for changes to propagate</li>
        </ol>
      </div>
      
      <div 
        ref={mapRef} 
        className={`w-full h-[400px] border ${mapStatus === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
      ></div>
      
      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

// Add the global type for the initMap callback
declare global {
  interface Window {
    initMap?: () => void;
    google?: any;
  }
} 