# Audio Guide App - Bugs & Features Tracker

## Ongoing Issues and Pending Features

### Tour Creation & Navigation
1. **Tour Naming** 
   - Implement ability to name the tour at the tour creation stage
   - Allow users to provide a meaningful name before saving

2. **Route Information Accuracy**
   - ~~Fix the total time ETA + distance for each tour~~
   - ~~Currently using our heuristic instead of actual Google Maps ETA~~
   - ~~Add realistic assumptions around walking/transit distances and times~~

3. **Transportation Mode**
   - Fix transportation mode selection and implementation
   - Ensure selected mode is properly applied to route calculations

### Media & UI Improvements
4. **Google Places API Images**
   - ~~Fix incorrect URL parameter (`photoreference` -> `photo_reference`)~~
   - ~~Fix POI image display in selection modal by using the getUrl() method~~
   - Update database code to properly save image references
   - Handle image attribution requirements

5. **Tour Navigation Flow**
   - ~~Add a "Finish" button to the tour view that returns users to home page~~
   - Improve overall tour navigation experience

### Cleanup
   - Clean up any other testing elements from the production UI

## Real-time Data Issues
- Investigate why tour stops don't appear initially after saving a tour (require page refresh)
- Fix real-time updates for website data and images

## Completed Items
- **Fixed Tour Image Saving**: Fixed the tour image downloading and saving by moving long-running operations outside database transactions (May 11, 2024)
- **Added Finish Button**: Added a "Finish" button that appears on the last stop of a tour and returns users to the homepage (May 11, 2024)
- **Remove Test Features**: Removed the "Test Audio Guide" tab from the interface (May 10, 2024)
- **Fix Google Places API Images (UI)**: Fixed image display in POI selection by using Google's getUrl() function (May 10, 2024)
- **Fixed ETA Calculation**: Fixed the tour duration calculation and display across the application (May 10, 2024)
   - Added proper travel time buffer for realistic estimations
   - Fixed unit conversion issue between seconds and minutes
   - Fixed inconsistent time formatting between tour creation and listing views 