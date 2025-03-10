'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Add debug logging for navigation
const NAV_DEBUG = true;
const logNav = (...args: any[]) => {
  if (NAV_DEBUG) {
    console.log(`🧭 NAV [${new Date().toISOString().split('T')[1].split('.')[0]}]:`, ...args);
  }
};

// Add global type for navigation timestamp
declare global {
  interface Window {
    _navTimestamp?: number;
  }
}

// Tour type definition
export interface TourPoi {
  id: string;
  sequence_number: number;
  poi: {
    id: string;
    name: string;
    formatted_address: string;
    location: { lat: number; lng: number };
    types: string[];
    rating: number | null;
    photo_references: string[] | null;
    website?: string | null;
  };
}

export interface Tour {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  last_updated_at: string;
  start_location: { lat: number; lng: number; address?: string };
  end_location: { lat: number; lng: number; address?: string };
  return_to_start: boolean;
  transportation_mode: string;
  total_distance: number;
  total_duration: number;
  google_maps_url: string | null;
  tourPois: TourPoi[];
}

interface TourListProps {
  tours: Tour[];
  loading: boolean;
}

export default function TourList({ tours, loading }: TourListProps) {
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [newTourName, setNewTourName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const toggleExpand = (tourId: string) => {
    setExpandedTourId(expandedTourId === tourId ? null : tourId);
  };

  const startRenaming = (tourId: string, currentName: string) => {
    setEditingTourId(tourId);
    setNewTourName(currentName);
  };

  const cancelRenaming = () => {
    setEditingTourId(null);
    setNewTourName('');
  };

  const confirmDelete = (tourId: string) => {
    setShowDeleteConfirm(tourId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const deleteTour = async (tourId: string) => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete tour');
      }
      
      // Use filter to create a new array without the deleted tour
      const updatedTours = tours.filter(tour => tour.id !== tourId);
      
      // Update the tours array immutably
      if (tours.length !== updatedTours.length) {
        // Replace the content of the tours array without changing the reference
        tours.splice(0, tours.length, ...updatedTours);
      }
      
      // Clear any expanded or editing state related to this tour
      if (expandedTourId === tourId) {
        setExpandedTourId(null);
      }
      
      toast.success('Tour deleted successfully');
      setShowDeleteConfirm(null);
      
      // Don't reload the entire list
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete tour');
    } finally {
      setIsDeleting(false);
    }
  };

  const saveTourName = async (tourId: string) => {
    if (!newTourName.trim()) {
      toast.error('Tour name cannot be empty');
      return;
    }
    
    setIsRenaming(true);
    
    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newTourName.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tour name');
      }
      
      // Update the local tour list without refreshing
      const updatedTour = tours.find(tour => tour.id === tourId);
      if (updatedTour) {
        updatedTour.name = newTourName.trim();
      }
      
      toast.success('Tour renamed successfully');
      setEditingTourId(null);
      
      // Don't reload the entire list
    } catch (error) {
      console.error('Error renaming tour:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename tour');
    } finally {
      setIsRenaming(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const getTransportIcon = (mode: string) => {
    switch (mode.toLowerCase()) {
      case 'walking':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4v16M20 10l-3.5 8-7-4" />
          </svg>
        );
      case 'driving':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M5 9l2 -4h8l2 4" />
            <path d="M5 9h12v5h-3" />
          </svg>
        );
      case 'transit':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
            <path d="M16 9m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" />
            <path d="M7.5 11h5.5" />
            <path d="M7 5l-4 7h9l-4 7" />
            <path d="M22 5l-4 7h-9" />
          </svg>
        );
      case 'bicycling':
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M19 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M12 17h-2a2 2 0 0 1 -2 -2v-6m2 6l5 -10l3 4" />
            <path d="M12 17l-3 -3l2 -2l5 1l-3 3" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2c-3.87 0 -7 3.13 -7 7c0 5.25 7 13 7 13s7 -7.75 7 -13c0 -3.87 -3.13 -7 -7 -7z" />
            <path d="M12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" />
          </svg>
        );
    }
  };
  
  const getGoogleMapsUrl = (tour: Tour) => {
    if (tour.google_maps_url) return tour.google_maps_url;
    
    // If google_maps_url is not available, create one from the tour data
    let url = 'https://www.google.com/maps/dir/?api=1';
    
    // Add origin - use address if available, otherwise coordinates
    if (tour.start_location.address) {
      url += `&origin=${encodeURIComponent(tour.start_location.address)}`;
    } else {
      url += `&origin=${tour.start_location.lat},${tour.start_location.lng}`;
    }
    
    // Add destination - use address if available, otherwise coordinates
    if (tour.return_to_start) {
      if (tour.start_location.address) {
        url += `&destination=${encodeURIComponent(tour.start_location.address)}`;
      } else {
        url += `&destination=${tour.start_location.lat},${tour.start_location.lng}`;
      }
    } else {
      if (tour.end_location.address) {
        url += `&destination=${encodeURIComponent(tour.end_location.address)}`;
      } else {
        url += `&destination=${tour.end_location.lat},${tour.end_location.lng}`;
      }
    }
    
    // Add POIs as waypoints
    if (tour.tourPois.length > 0) {
      const waypoints = tour.tourPois
        .sort((a, b) => a.sequence_number - b.sequence_number)
        .map(poi => {
          if (poi.poi.formatted_address) {
            return encodeURIComponent(poi.poi.formatted_address);
          } else {
            return `${poi.poi.location.lat},${poi.poi.location.lng}`;
          }
        })
        .join('|');
      
      url += `&waypoints=${waypoints}`;
    }
    
    // Add travel mode
    if (tour.transportation_mode) {
      const travelMode = tour.transportation_mode.toLowerCase();
      url += `&travelmode=${travelMode}`;
    }
    
    return url;
  };

  if (loading) {
    return (
      <div className="space-y-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 p-6 rounded-lg animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg mt-6 text-center">
        <h3 className="text-lg font-medium text-gray-600 mb-2">No tours yet</h3>
        <p className="text-gray-500 mb-4">Create your first personalized tour to see it here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {tours.map((tour) => (
        <div 
          key={tour.id} 
          className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow relative"
        >
          {/* Centered confirmation dialog without dark overlay */}
          {showDeleteConfirm === tour.id && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="bg-white border border-gray-200 rounded-md shadow-md py-3 px-4 text-sm z-30 relative max-w-[200px]">
                <p className="text-gray-700 mb-3 text-center font-medium">Delete this tour?</p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteTour(tour.id)}
                    className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors flex items-center"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              {editingTourId === tour.id ? (
                <div className="flex-1 mr-2">
                  <input
                    type="text"
                    value={newTourName}
                    onChange={(e) => setNewTourName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tour name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveTourName(tour.id);
                      } else if (e.key === 'Escape') {
                        cancelRenaming();
                      }
                    }}
                  />
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() => saveTourName(tour.id)}
                      disabled={isRenaming}
                      className="text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md text-sm font-medium flex items-center"
                    >
                      {isRenaming ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      onClick={cancelRenaming}
                      disabled={isRenaming}
                      className="text-gray-700 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-md text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center mr-2 group">
                  <h3 
                    className="text-lg font-medium text-gray-800 hover:text-blue-600 cursor-pointer"
                    onClick={() => toggleExpand(tour.id)}
                  >
                    {tour.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent expanding/collapsing when clicking edit
                      startRenaming(tour.id, tour.name);
                    }}
                    className="ml-2 p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full group-hover:opacity-100 opacity-60 cursor-pointer"
                    title="Rename tour"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent expanding/collapsing when clicking delete
                      confirmDelete(tour.id);
                    }}
                    className="ml-1 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full group-hover:opacity-100 opacity-60 cursor-pointer"
                    title="Delete tour"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="text-gray-400">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-5 w-5 transition-transform ${expandedTourId === tour.id ? 'transform rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  onClick={() => toggleExpand(tour.id)}
                  cursor="pointer"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {tour.description && (
              <p className="text-gray-600 text-sm mb-2 line-clamp-2">{tour.description}</p>
            )}
            
            <div className="flex flex-wrap gap-2 items-center mt-3 text-sm text-gray-500">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>{formatDate(tour.created_at)}</span>
              </div>
              
              <div className="flex items-center ml-3">
                <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2c-3.87 0 -7 3.13 -7 7c0 5.25 7 13 7 13s7 -7.75 7 -13c0 -3.87 -3.13 -7 -7 -7z" />
                  <path d="M12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" />
                </svg>
                <span>{(tour.total_distance).toFixed(1)} km</span>
              </div>
              
              <div className="flex items-center ml-3">
                <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{formatDuration(tour.total_duration)}</span>
              </div>
              
              <div className="flex items-center ml-3">
                {getTransportIcon(tour.transportation_mode)}
                <span className="ml-1 capitalize">{tour.transportation_mode}</span>
              </div>
              
              <div className="flex items-center ml-3">
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                  {tour.tourPois?.length || 0} stops
                </span>
              </div>
            </div>
          </div>

          {expandedTourId === tour.id && (
            <div className="border-t border-gray-200 p-4">
              {/* Start and End Location Section */}
              <div className="mb-6 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-start mb-3">
                  <div className="min-w-8 mt-1 mr-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Start Location</p>
                    <p className="text-gray-600 text-sm">{tour.start_location.address || `${tour.start_location.lat.toFixed(6)}, ${tour.start_location.lng.toFixed(6)}`}</p>
                  </div>
                </div>
                
                {!tour.return_to_start && (
                  <div className="flex items-start">
                    <div className="min-w-8 mt-1 mr-2">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">End Location</p>
                      <p className="text-gray-600 text-sm">{tour.end_location.address || `${tour.end_location.lat.toFixed(6)}, ${tour.end_location.lng.toFixed(6)}`}</p>
                    </div>
                  </div>
                )}
                
                {tour.return_to_start && (
                  <div className="flex items-start">
                    <div className="min-w-8 mt-1 mr-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Return to Start</p>
                      <p className="text-gray-600 text-sm">This tour returns to the starting point</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Tour Stops Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-8-4.5-8-11.8a8 8 0 0 1 16 0c0 7.3-8 11.8-8 11.8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Tour Stops
                </h4>
                <div className="space-y-2">
                  {tour.tourPois
                    .sort((a, b) => a.sequence_number - b.sequence_number)
                    .map((tourPoi) => (
                      <div key={tourPoi.id} className="flex items-start p-2 hover:bg-gray-50 rounded-md transition-colors">
                        <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">
                          {tourPoi.sequence_number + 1}
                        </div>
                        <div>
                          <h5 className="text-gray-800 font-medium">{tourPoi.poi.name}</h5>
                          <p className="text-gray-500 text-sm">{tourPoi.poi.formatted_address}</p>
                          {tourPoi.poi.rating && (
                            <div className="flex items-center mt-1">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg 
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.round(tourPoi.poi.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                                    xmlns="http://www.w3.org/2000/svg" 
                                    viewBox="0 0 20 20" 
                                    fill="currentColor"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-xs text-gray-500 ml-1">{tourPoi.poi.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="mt-6 flex flex-wrap gap-2 justify-between">
                <div className="flex gap-2">
                  <a 
                    href={getGoogleMapsUrl(tour)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    View Route in Google Maps
                  </a>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startRenaming(tour.id, tour.name);
                    }}
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium inline-flex items-center bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Rename Tour
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(tour.id);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium inline-flex items-center bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Tour
                  </button>
                </div>

                <Link
                  href={`/tour/${tour.id}`}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center"
                  onClick={() => {
                    logNav(`Navigating to tour: ${tour.id}`);
                    logNav(`Current URL: ${window.location.href}`);
                    logNav(`Navigation triggered by Link component`);
                    logNav(`Current visibility state: ${document.visibilityState}`);
                    
                    // Log cookies at navigation time
                    const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
                    logNav(`Cookies at navigation: ${cookies.join(', ')}`);
                    
                    // Capture navigation timestamp for duration tracking
                    window._navTimestamp = Date.now();
                  }}
                >
                  <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10l-9 5l9 5l9 -5l-9 -5z"></path>
                    <path d="M6 15v4.5l9 5l9 -5v-4.5"></path>
                    <path d="M15 5l-9 5l9 5l9 -5l-9 -5z"></path>
                  </svg>
                  Start Tour
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 