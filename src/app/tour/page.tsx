'use client';

import { useState } from 'react';
import Link from 'next/link';

// Tour preferences interface
interface TourPreferences {
  interests: string[];
  duration: number; // in minutes
  distance: number; // in kilometers
}

// Available interests
const interestOptions = [
  'History', 
  'Architecture', 
  'Art', 
  'Nature', 
  'Food', 
  'Shopping', 
  'Culture',
  'Religion',
  'Science'
];

// Duration options in minutes
const durationOptions = [30, 60, 90, 120, 180];

// Distance options in kilometers
const distanceOptions = [1, 2, 3, 5, 8];

export default function TourPage() {
  // State for tour preferences
  const [preferences, setPreferences] = useState<TourPreferences>({
    interests: ['History', 'Architecture'],
    duration: 60,
    distance: 2
  });

  // Toggle interest selection
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

  // Update duration
  const updateDuration = (duration: number) => {
    setPreferences(prev => ({
      ...prev,
      duration
    }));
  };

  // Update distance
  const updateDistance = (distance: number) => {
    setPreferences(prev => ({
      ...prev,
      distance
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would generate a tour
    console.log('Generating tour with preferences:', preferences);
    // Navigate to the generated tour page
  };

  return (
    <div className="max-w-xl mx-auto p-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Create Your Tour</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Interests Section */}
        <div>
          <h2 className="text-lg font-medium mb-3">What are you interested in?</h2>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map(interest => (
              <button
                type="button"
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  preferences.interests.includes(interest)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>
        
        {/* Duration Section */}
        <div>
          <h2 className="text-lg font-medium mb-3">How much time do you have?</h2>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map(duration => (
              <button
                type="button"
                key={duration}
                onClick={() => updateDuration(duration)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  preferences.duration === duration
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>
        
        {/* Distance Section */}
        <div>
          <h2 className="text-lg font-medium mb-3">How far are you willing to walk?</h2>
          <div className="flex flex-wrap gap-2">
            {distanceOptions.map(distance => (
              <button
                type="button"
                key={distance}
                onClick={() => updateDistance(distance)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  preferences.distance === distance
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {distance} km
              </button>
            ))}
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition duration-200"
          >
            Generate Tour
          </button>
        </div>
      </form>
    </div>
  );
} 