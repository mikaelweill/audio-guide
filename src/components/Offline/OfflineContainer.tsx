'use client';

import { useState, useEffect, ReactNode } from 'react';
import { isPwa } from '@/services/offlineTourService';

interface OfflineContainerProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function OfflineContainer({ 
  children, 
  title = "Offline Access", 
  description = "Download this tour to use it without an internet connection." 
}: OfflineContainerProps) {
  const [isPwaMode, setIsPwaMode] = useState(false);
  
  // Check if we're in PWA mode on mount
  useEffect(() => {
    setIsPwaMode(isPwa());
  }, []);
  
  // Don't render anything if not in PWA mode
  if (!isPwaMode) {
    return null;
  }
  
  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-gray-300 mb-4">{description}</p>
      {children}
    </div>
  );
} 