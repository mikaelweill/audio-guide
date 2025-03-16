'use client';

import dynamic from 'next/dynamic';

// Dynamically import the OfflineIndicator with no SSR to prevent hydration issues
const OfflineIndicator = dynamic(() => import('./OfflineIndicator'), { ssr: false });

export default function OfflineDetector() {
  return <OfflineIndicator />;
} 