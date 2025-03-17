'use client';

import { useState, useEffect } from 'react';
import { Tour } from '@/types/tours';
import DownloadProgress from './DownloadProgress';
import { 
  checkIfTourIsDownloaded,
  downloadTour,
  deleteTour
} from '@/services/offlineTourService';

interface DownloadTourButtonProps {
  tour: Tour;
  audioData: Record<string, {
    brief: string;
    detailed: string;
    complete: string;
  }>;
}

export default function DownloadTourButton({ tour, audioData }: DownloadTourButtonProps) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check if tour is already downloaded on component mount
  useEffect(() => {
    const checkDownloadStatus = async () => {
      try {
        const downloaded = await checkIfTourIsDownloaded(tour.id);
        setIsDownloaded(downloaded);
      } catch (err) {
        console.error('Error checking download status:', err);
      }
    };

    checkDownloadStatus();
  }, [tour.id]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);
    
    try {
      await downloadTour(
        tour,
        audioData,
        (progress, status) => {
          setDownloadProgress(progress);
          if (status) setDownloadStatus(status);
        }
      );
      setIsDownloaded(true);
    } catch (err) {
      console.error('Error downloading tour:', err);
      setError(err instanceof Error ? err.message : 'Failed to download tour');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTour(tour.id);
      setIsDownloaded(false);
    } catch (err) {
      console.error('Error deleting tour:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete tour');
    }
  };

  if (isDownloading) {
    return (
      <div className="my-4">
        <DownloadProgress progress={downloadProgress} status={downloadStatus} />
      </div>
    );
  }

  if (isDownloaded) {
    return (
      <div className="flex flex-col space-y-2">
        <div className="flex items-center text-green-400">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
              clipRule="evenodd" 
            />
          </svg>
          <span>Downloaded for offline use</span>
        </div>
        <button
          onClick={handleDelete}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-2" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
          Remove offline version
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <button
        onClick={handleDownload}
        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4 mr-2" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" 
            clipRule="evenodd" 
          />
        </svg>
        Download for offline use
      </button>
    </div>
  );
} 