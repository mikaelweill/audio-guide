'use client';

import { useEffect } from 'react';

export default function DebugLogger({ data }: { data: any }) {
  useEffect(() => {
    console.log('Debug data:', data);
  }, [data]);
  
  return null;
} 