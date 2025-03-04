# Points of Interest (POI) Tour Generation Algorithm

This document outlines the step-by-step implementation for generating personalized tours using the Google Places API based on user preferences, with a user-centric selection model.

## Algorithm Overview

Our tour generation algorithm uses a two-phase approach:
1. **Discovery Phase**: Present users with high-quality POI options based on their preferences
2. **Route Optimization Phase**: Generate an optimal route using only the POIs selected by the user

This approach balances:
- User interests (categories of places)
- User agency (explicit selection of preferred POIs)
- Time constraints (tour duration)
- Distance preferences (walking distance)
- Location quality (ratings and popularity)
- Start and end location requirements

## Implementation Steps

### Phase 1: POI Discovery & Presentation

#### 1. Data Collection from User Preferences

- **Input Parameters**:
  - `interests`: Array of categories (e.g., "History", "Art", "Architecture")
  - `duration`: Tour duration in minutes (e.g., 60, 90, 120)
  - `distance`: Maximum walking distance in kilometers (e.g., 1, 2, 5)
  - `startLocation`: Coordinates and address of starting point
  - `endLocation`: Coordinates and address of ending point (or null)
  - `returnToStart`: Boolean indicating if tour should return to starting point

#### 2. Calculate Search Parameters

- **Search Radius Calculation**:
  ```javascript
  // Calculate search radius based on user's distance preference
  const searchRadius = userDistance * 1000; // Convert km to meters for API
  
  // Adjust for circular tours (if returning to start)
  const effectiveRadius = returnToStart ? searchRadius / 2 : searchRadius;
  ```

- **Estimate Recommended POI Count**:
  ```javascript
  // Estimate how many POIs can fit in the given duration
  // Assuming average time at each POI + travel time between them
  const AVG_TIME_PER_POI = 20; // minutes per POI
  const AVG_WALKING_TIME = 10; // minutes between POIs
  
  const totalTravelTime = userDuration - (userDuration * 0.2); // Reserve 20% for buffer
  const recommendedPOICount = Math.floor(totalTravelTime / (AVG_TIME_PER_POI + AVG_WALKING_TIME));
  
  // Number of POIs to present for selection (more options than needed)
  const presentationPOICount = Math.min(20, recommendedPOICount * 4);
  ```

#### 3. API Calls to Google Places

- **Nearby Search Request**:
  ```javascript
  // For each interest category, make a request to the Google Places API
  for (const interest of userInterests) {
    const response = await googleMapsClient.placesNearby({
      location: startLocation.position,
      radius: effectiveRadius,
      keyword: interest,
      type: mapInterestToGoogleType(interest), // Map our categories to Google's types
      rankby: 'prominence' // Default ranking by prominence
    });
    
    // Store results
    allPOIs = [...allPOIs, ...response.results];
  }
  ```

- **Type Mapping Function**:
  ```javascript
  function mapInterestToGoogleType(interest) {
    const mapping = {
      'History': ['museum', 'historic', 'landmark'],
      'Architecture': ['landmark', 'church', 'place_of_worship'],
      'Art': ['art_gallery', 'museum'],
      'Nature': ['park', 'natural_feature'],
      'Food': ['restaurant', 'cafe', 'bakery']
    };
    
    return mapping[interest] || [];
  }
  ```

#### 4. POI Filtering and Ranking

- **Filter by Rating**:
  ```javascript
  // Filter places with ratings above 4.0
  const qualityPOIs = allPOIs.filter(poi => poi.rating >= 4.0);
  
  // Remove duplicates (same place might appear in different categories)
  const uniquePOIs = removeDuplicates(qualityPOIs);
  ```

- **Rank by Number of Reviews and Relevance**:
  ```javascript
  // Sort by number of user ratings (popularity metric)
  const rankedPOIs = uniquePOIs.sort((a, b) => b.user_ratings_total - a.user_ratings_total);
  
  // Take top N for presentation to user
  let presentationPOIs = rankedPOIs.slice(0, presentationPOICount);
  ```

#### 5. Fetch Detailed Information for Presentation POIs

- **Place Details Request**:
  ```javascript
  // For each POI in the presentation set, fetch detailed information
  const enhancedPresentationPOIs = await Promise.all(presentationPOIs.map(async (poi) => {
    const details = await googleMapsClient.placeDetails({
      place_id: poi.place_id,
      fields: ['name', 'formatted_address', 'photo', 'opening_hours', 'url', 'website', 'price_level', 'review']
    });
    
    return {
      ...poi,
      details: details.result
    };
  }));
  ```

#### 6. Present POIs to User for Selection

- **UI Presentation**:
  - Display POIs in an interactive grid or list view
  - Show key information: name, image, rating, brief description
  - Allow selection via checkboxes or toggle buttons
  - Indicate recommended selection count (e.g., "Select 5 places")
  - Provide "Continue" button that activates once enough POIs are selected
  - Include distance and time estimates for each POI

### Phase 2: User Selection & Route Optimization

#### 7. Process User Selections

- **Input Parameters**:
  - `selectedPOIs`: Array of POIs chosen by the user
  - Original user preferences from step 1

#### 8. Calculate Distances Between Selected POIs

- **Distance Matrix Request**:
  ```javascript
  // Use Google Distance Matrix API to calculate actual walking times between all POIs
  const distanceMatrix = await googleMapsClient.distanceMatrix({
    origins: [startLocation.position, ...selectedPOIs.map(poi => poi.geometry.location)],
    destinations: [...selectedPOIs.map(poi => poi.geometry.location), endLocation ? endLocation.position : startLocation.position],
    mode: 'walking',
    units: 'metric'
  });
  ```

#### 9. Build Optimized Tour Route

- **Optimize with TSP Algorithm**:
  ```javascript
  // Initialize with starting point
  const tourRoute = [];
  let currentLocation = startLocation;
  let remainingPOIs = [...selectedPOIs];
  
  // Start with the starting location
  tourRoute.push(startLocation);
  
  // Find the optimal next POI at each step
  while (remainingPOIs.length > 0) {
    // Find nearest POI to current location
    const [nextPOI, travelTime] = findNearestPOI(currentLocation, remainingPOIs, distanceMatrix);
    
    tourRoute.push(nextPOI);
    
    // Remove the selected POI from remaining list
    remainingPOIs = remainingPOIs.filter(poi => poi.place_id !== nextPOI.place_id);
    
    // Update current location
    currentLocation = nextPOI;
  }
  
  // Add the end location (or return to start)
  if (returnToStart) {
    tourRoute.push({
      ...startLocation,
      isReturnToStart: true
    });
  } else if (endLocation && endLocation.position) {
    tourRoute.push(endLocation);
  }
  ```

#### 10. Calculate Final Route Details

- **Tour Statistics**:
  ```javascript
  // Calculate total distance, duration, and other stats
  const POI_VISIT_DURATION = 20; // minutes
  
  const tourStats = {
    totalPOIs: selectedPOIs.length,
    totalWalkingDistance: calculateTotalDistance(tourRoute, distanceMatrix),
    totalWalkingTime: calculateTotalWalkingTime(tourRoute, distanceMatrix),
    totalVisitTime: selectedPOIs.length * POI_VISIT_DURATION,
    totalTourDuration: calculateTotalTourTime(tourRoute, distanceMatrix, POI_VISIT_DURATION)
  };
  ```

#### 11. Tour Result Format

- **Final Output Structure**:
  ```javascript
  const tourResult = {
    route: tourRoute,
    stats: tourStats,
    preferences: {
      interests: userInterests,
      duration: userDuration,
      distance: userDistance,
      returnToStart: returnToStart
    },
    selectedPOIs: selectedPOIs,
    map: {
      center: startLocation.position,
      zoom: calculateOptimalZoom(tourRoute)
    }
  };
  ```

## Implementation Considerations

### User Experience Optimization

1. **Selection Guidance**:
   - Provide clear guidance on how many POIs to select based on duration
   - Show estimated total tour time as selections are made
   - Allow users to see a preliminary route as they make selections

2. **POI Presentation**:
   - Ensure diverse options across all selected interest categories
   - Highlight distance from starting point and estimated visit duration
   - Provide rich visuals and essential information for informed selection

3. **Feedback Loop**:
   - Allow users to refine their search if presented POIs don't meet expectations
   - Provide option to see more POIs if initial set doesn't contain desired options

### API Quotas and Optimization

1. **Caching Strategies**:
   - Cache places search results for popular locations
   - Store distance matrix results to reduce API calls
   - Implement local database for frequently visited areas

2. **Request Batching**:
   - Combine place searches where possible
   - Use batch requests for place details

3. **Rate Limiting**:
   - Implement backoff strategy for API limits

### Edge Cases

1. **Few or No Results**:
   - If insufficient POIs match the criteria, gradually relax constraints:
     - Reduce minimum rating threshold
     - Increase search radius
     - Include more POI types

2. **User Selects Too Many/Few POIs**:
   - Provide warnings if user selection doesn't align with time budget
   - Allow override but with clear indicators of estimated tour duration

3. **Unreachable Locations**:
   - Handle cases where walking between certain POIs is not possible
   - Suggest alternative transportation when distances exceed walking thresholds

## Future Enhancements

1. **Advanced Route Optimization**:
   - Implement full Traveling Salesman Problem solutions for optimal ordering
   - Consider weather and time of day in route planning

2. **User Personalization**:
   - Learn from user selections to improve future POI recommendations
   - Adjust presentation order based on user history

3. **Multi-modal Transportation**:
   - Incorporate public transit options
   - Add ride-sharing integration for longer segments

4. **Time-aware Planning**:
   - Consider opening hours of attractions
   - Account for peak visiting times and crowds

5. **Selection Refinement**:
   - Allow reordering of selected POIs to influence route
   - Provide "must-visit" designation for critical POIs 