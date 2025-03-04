'use client';

import React, { useState } from 'react';

interface TourPreferences {
  interests: string[];
  duration: number; // in minutes
  distance: number; // in kilometers
}

// Available options
const INTERESTS_OPTIONS = [
  'History', 'Architecture', 'Art', 'Food', 
  'Nature', 'Shopping'
];

const DURATION_OPTIONS = [30, 60, 90, 120]; // in minutes
const DISTANCE_OPTIONS = [1, 2, 5, 10]; // in kilometers

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TourModal({ isOpen, onClose }: TourModalProps) {
  const [preferences, setPreferences] = useState<TourPreferences>({
    interests: [],
    duration: 60,
    distance: 2
  });

  const toggleInterest = (interest: string) => {
    setPreferences(prev => {
      if (prev.interests.includes(interest)) {
        return {
          ...prev,
          interests: prev.interests.filter(i => i !== interest)
        };
      } else {
        return {
          ...prev,
          interests: [...prev.interests, interest]
        };
      }
    });
  };

  const updateDuration = (duration: number) => {
    setPreferences(prev => ({
      ...prev,
      duration
    }));
  };

  const updateDistance = (distance: number) => {
    setPreferences(prev => ({
      ...prev,
      distance
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating tour with preferences:', preferences);
    // Here you would call your API to generate the tour
    // After tour is created, close the modal
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-50 flex items-center justify-center pointer-events-none inset-0">
      <div className="bg-white rounded-lg p-8 max-w-md w-full pointer-events-auto shadow-2xl border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create Your Tour</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Interests Section */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">What are you interested in?</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS_OPTIONS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-2 rounded-full text-sm transition duration-200 ${
                    preferences.interests.includes(interest)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            {preferences.interests.length === 0 && (
              <p className="text-red-500 text-xs mt-1">Please select at least one interest</p>
            )}
          </div>

          {/* Duration Section */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">Tour Duration (minutes)</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateDuration(option)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 ${
                    preferences.duration === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Section */}
          <div className="mb-8">
            <label className="block text-gray-700 font-medium mb-2">Walking Distance (km)</label>
            <div className="flex gap-2">
              {DISTANCE_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateDistance(option)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm transition duration-200 ${
                    preferences.distance === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={preferences.interests.length === 0}
            className={`w-full py-3 rounded-md text-white font-medium transition duration-200 ${
              preferences.interests.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Generate Tour
          </button>
        </form>
      </div>
    </div>
  );
} 