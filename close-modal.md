# Modal Closing Issue & Solution

## Current Problem

Our `TourModal` component is having trouble closing properly when a tour is saved. Here's what's happening:

1. **Mixed Responsibilities**: The `saveWithSupabaseFunction` is trying to do too many things:
   - Prepare data
   - Close the modal
   - Save to the database
   - Call Supabase edge functions
   - Handle errors
   - Show notifications

2. **Execution Flow Issues**: 
   - React state updates (like closing a modal) are not immediately reflected in the DOM
   - By trying to do database operations in the same function, we're potentially blocking the UI thread
   - Even with our setTimeout approach, there's no guarantee the modal has fully closed before we start heavy operations

3. **Nested Complexity**:
   - We have a synchronous function → setTimeout → async function structure
   - This makes debugging difficult and introduces potential race conditions

## Proper Solution

The fundamental issue is mixing UI concerns (modal state) with data operations. Here's the correct approach:

### 1. Separation of Concerns

Let the parent component handle data operations, and let the modal component handle only its own display logic:

```jsx
// Parent component
function TourList() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tours, setTours] = useState([]);

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const saveTour = async (tourData) => {
    try {
      // Save to database
      const response = await fetch('/api/tours', {...});
      // Handle response
      // Call Supabase functions
      // Show notifications
    } catch (error) {
      // Handle errors
    }
  };

  return (
    <div>
      <TourModal 
        isOpen={isModalOpen} 
        onClose={closeModal}
        onSave={(data) => {
          closeModal(); // Close modal first
          saveTour(data); // Then save data
        }}
      />
    </div>
  );
}
```

### 2. Clean Modal Component

The modal should focus only on collecting data and handling its internal UI state:

```jsx
function TourModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({});
  
  const handleSave = () => {
    onSave(formData); // Pass data to parent and let it handle everything else
  };
  
  return (
    isOpen && (
      <div className="modal">
        {/* Modal content */}
        <button onClick={handleSave}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    )
  );
}
```

## Implementation Steps

1. **Move Data Operations to Parent**:
   - Transfer database saving and Supabase function calls to the parent component
   - Pass only the necessary data from the modal to the parent

2. **Clean Up Modal Component**:
   - Remove all async operations from the modal
   - Focus only on data collection and UI state
   - Call `onSave` with the data when saving

3. **Update Parent Component**:
   - Implement a clear sequence: close modal first, then handle data operations
   - Keep all async operations in the parent
   - Use proper async/await with try/catch

4. **Proper State Management**:
   - Use React state for controlling modal visibility
   - Let React's natural rendering cycle handle the UI updates
   - Don't use any tricks or hacks to force modal closure

## Why This Works Better

- **Proper React Patterns**: Following React's unidirectional data flow
- **Better UI Responsiveness**: Modal closes immediately because it's not blocked by data operations
- **Easier Debugging**: Clear separation of UI logic and data operations
- **Maintainability**: Each component has a single responsibility 

## Specific Implementation for Our Codebase

After reviewing our actual code structure, here's the plan:

### 1. Update the Home Page Component (`/src/app/(protected)/page.tsx`)

```jsx
export default function Home() {
  // ... existing code ...
  
  // Add a new function to handle tour saving
  const saveTour = async (tourData) => {
    try {
      // Save to database
      const response = await fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tourData),
        credentials: 'include'
      });
      
      // Handle response
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.tourId) {
        // Show success notification
        toast.success('Tour saved successfully!');
        
        // Process POIs with Supabase if available
        if (tourData.route && tourData.route.length > 0) {
          processPOIsWithSupabase(tourData.route, result.tourId);
        }
        
        // Refresh tour list
        fetchTours();
      }
    } catch (error) {
      console.error('Error saving tour:', error);
      toast.error(`Failed to save tour: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Add function to process POIs with Supabase
  const processPOIsWithSupabase = async (pois, tourId) => {
    try {
      const { createClient } = require('@/utils/supabase/client');
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      
      if (!accessToken) {
        console.error('No access token available');
        return;
      }
      
      // Process first POI as a test
      const firstPoi = pois[0];
      const response = await fetch(
        'https://uzqollduvddowyzjvmzn.supabase.co/functions/v1/process-poi',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ 
            poiData: {
              id: firstPoi.place_id,
              place_id: firstPoi.place_id,
              basic: {
                name: firstPoi.name,
                formatted_address: firstPoi.vicinity || '',
                location: firstPoi.geometry?.location || { lat: 0, lng: 0 },
                types: firstPoi.types || ["point_of_interest"],
              },
              wikipedia: { extract: "Short test extract for Wikipedia." },
              wikivoyage: { extract: "Short test extract for Wikivoyage." }
            }
          }),
        }
      );
      
      if (response.ok) {
        console.log('Supabase function succeeded');
      } else {
        console.error('Supabase function failed:', await response.text());
      }
    } catch (error) {
      console.error('Error processing POIs with Supabase:', error);
    }
  };
  
  return (
    <div>
      {/* ... existing code ... */}
      
      {/* Updated TourModal with new onSave prop */}
      <TourModal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        userLocation={userLocation || undefined}
        mapsApiLoaded={isLoaded}
        onSave={(tourData) => {
          // First close the modal immediately
          closeModal();
          // Then handle the saving separately
          saveTour(tourData);
        }}
      />
    </div>
  );
}
```

### 2. Simplify the TourModal Component (`/src/components/TourModal.tsx`)

```jsx
// Update the TourModalProps interface
interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tourData: any) => void; // Add new prop
  userLocation?: {
    lat: number;
    lng: number;
  };
  mapsApiLoaded: boolean;
}

export default function TourModal({ isOpen, onClose, onSave, userLocation = DEFAULT_LOCATION, mapsApiLoaded }: TourModalProps) {
  // ... existing state and functions ...
  
  // Replace the complex saveWithSupabaseFunction with a simple handleSave function
  const handleSave = () => {
    // Prepare the data
    const tourName = formData.tourName || `Tour near ${preferences.startLocation.address}`;
    
    // Create simplified route data
    const simplifiedRoute = tourRoute
      .filter(poi => !poi.types.includes('starting_point') && !poi.types.includes('end_point'))
      .map(poi => ({
        place_id: poi.place_id,
        name: poi.name,
        types: poi.types,
        geometry: poi.geometry,
        vicinity: poi.vicinity,
        rating: poi.rating,
        photos: poi.photos
      }));
      
    // Prepare API payload
    const payload = {
      name: tourName,
      description: formData.tourDescription || '',
      route: simplifiedRoute,
      preferences: {
        interests: preferences.interests,
        duration: preferences.duration,
        distance: preferences.distance,
        startLocation: {
          position: preferences.startLocation.position || userLocation,
          address: preferences.startLocation.address,
          useCurrentLocation: preferences.startLocation.useCurrentLocation
        },
        endLocation: {
          position: preferences.endLocation.position || userLocation,
          address: preferences.endLocation.address,
          useCurrentLocation: preferences.endLocation.useCurrentLocation
        },
        returnToStart: preferences.returnToStart,
        transportationMode: preferences.transportationMode
      },
      stats: tourStats
    };
    
    // Pass data to parent and let it handle saving and modal closure
    onSave(payload);
  };
  
  // Replace handleSaveTour to use the new handleSave function
  const handleSaveTour = () => {
    setIsSaving(true);
    
    // Just call the clean handler
    handleSave();
  };
  
  // ... rest of the component remains the same ...
}
```

This approach follows proper React patterns, ensures the modal closes immediately, and maintains a clean separation of concerns between UI and data operations. 