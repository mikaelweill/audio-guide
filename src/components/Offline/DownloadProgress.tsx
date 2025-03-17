'use client';

interface DownloadProgressProps {
  progress: number; // 0-100
  status?: string;
}

export default function DownloadProgress({ progress, status }: DownloadProgressProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-white">Downloading</span>
        <span className="text-sm font-medium text-white">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div 
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      {status && (
        <p className="text-xs text-gray-400 mt-1">{status}</p>
      )}
    </div>
  );
} 