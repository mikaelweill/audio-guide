# Personalized Audio Travel Guide - Implementation Strategy

## Overview
This document outlines the implementation strategy for the Personalized Audio Travel Guide application, based on the original PRD and subsequent discussions. It focuses on immediate priorities, technical approaches, and implementation decisions.

## Current Progress (Updated: May 2024)

### Completed Features
1. **User Authentication**:
   - Email-based OTP authentication using Supabase
   - Enhanced login/signup UX with improved form design
   - 6-digit code verification with auto-submit functionality
   - Customized email templates for verification codes
   - Route protection middleware for authenticated sections

2. **Security & Navigation**:
   - Proper route protection to ensure unauthenticated users cannot access the main app
   - Multi-layered authentication checks (server middleware + client-side)
   - Improved header component showing correct auth state
   - Fixed favicon implementation for app branding

3. **UX Improvements**:
   - Streamlined authentication flow
   - Enhanced OTP verification process with individual digit inputs
   - Auto-continue functionality upon entering 6-digit code
   - Clear user feedback during authentication process

## MVP Scope & Priorities

### Core User Experience
- **Location-Agnostic Design**: The app works anywhere in the world based on user's GPS coordinates
- **On-Demand Tour Generation**: Users open the app, set preferences, and receive a customized tour
- **Guided Audio Experience**: Each POI provides audio narration as users approach
- **Simple Linear Routing**: Optimized walking paths between POIs with flexibility to skip ahead
- ✅ **Basic User Authentication**: Simple signup/login for saving preferences and tour history

### MVP Feature Set
1. **Location Detection**: Auto-detect user's location via browser GPS
2. **Basic Preference Filtering**: Interests, duration, and distance preferences
3. **Tour Generation**: Create walking routes with relevant POIs
4. **Audio Narration**: Generate spoken descriptions for each POI
5. **Map Interface**: Display route and POIs on Google Maps
6. **Basic Navigation**: Guide users between POIs
7. ✅ **User Authentication**: Email-based OTP authentication via Supabase

### Out of Scope for MVP
- Advanced analytics
- Social features
- AR components
- Monetization features
- Complex personalization algorithms

## Technical Implementation

### Frontend
- **Framework**: Next.js
- **Map Integration**: Google Maps API
- **State Management**: Using React context for auth state management
- **Authentication**: Custom OTP implementation with Supabase

### Backend Components
- **Database & Auth**: Supabase for authentication and data storage
  - User profiles
  - Tour history
  - User preferences
  - POI ratings/feedback (if implemented)

- **POI Data Sources**:
  - Wikipedia (for famous landmarks)
  - OpenTripMap API
  - Atlas Obscura API (for unique attractions)
  - Wikivoyage
  - OpenStreetMap data
  - Google Places API

- **Audio Generation**:
  - Text-to-speech using OpenAI API or ElevenLabs
  - Multiple language support through translation APIs

- **Routing**:
  - Google Directions API for path calculation
  - Custom algorithm for POI selection based on user preferences

### Offline Capabilities
- Download current tour for offline use
- Cache maps for current area
- Store audio content for selected POIs
- Sync with Supabase when reconnected

## Content Strategy

### POI Content Approach
- **Famous Landmarks**: Aggregated from Wikipedia and other established sources
- **Lesser-Known POIs**: Combination of available APIs, generated content, and contextual information
- **Audio Generation**: TTS with high-quality voices (OpenAI/ElevenLabs)

### Content Length Management
- **Layered Content Structure**:
  - Core layer: Essential facts (30-60 seconds)
  - Secondary layer: Interesting details (additional 1-2 minutes)
  - Tertiary layer: Deep context (additional 3+ minutes)

- **User Controls**:
  - "Tell me more" option for additional content
  - Skip/fast-forward functionality
  - Basic content length preference setting

## Data Management

### User Data
- ✅ **Authentication**: Implemented via Supabase Auth
  - Email OTP authentication
  - Enhanced verification UX
  - Route protection

- **User Profile**:
  - Basic preferences (interests, preferred tour length, etc.)
  - Language settings
  - Accessibility preferences
  
- **Storage Strategy**:
  - All user data stored in Supabase
  - Minimal necessary data collected for core functionality
  - Option for anonymous usage with limited features

### Tour Data
- Generated on-demand based on current location
- POI information fetched at time of tour generation
- Routes optimized for walking distance and POI relevance
- Completed tours saved to user's history in Supabase

## Development Approach

### Priority Order (Updated)
1. ⏩ **Core route generation and POI selection** (Next priority)
2. ⏩ **Map interface and basic navigation** (Next priority)
3. ⏩ **Content generation pipeline** (Upcoming priority)
4. **Audio playback system**
5. ✅ **User authentication and profiles** (Completed)
6. **Offline capabilities**
7. **UI refinement and testing**

### Next Steps
1. **Implement User Location Detection**:
   - Browser geolocation integration
   - Default location handling for testing/demo purposes
   - Permission request UX

2. **Build Basic Map Interface**:
   - Integrate Google Maps more thoroughly
   - Create map controls (zoom, center on user, etc.)
   - Display user location with appropriate markers

3. **Develop User Preferences System**:
   - Create preference selection UI
   - Store user preferences in Supabase
   - Implement preference-based filtering

4. **Begin POI Data Integration**:
   - Connect to initial data sources (Wikipedia, OpenTripMap)
   - Implement POI fetching based on location
   - Create POI filtering and selection algorithm

### Supabase Implementation
- **Database Schema**: 
  - ✅ Users table (extended from Supabase auth)
  - Tours table (with user_id foreign key)
  - Preferences table
  - Tour history table

- **Security Rules**:
  - ✅ Row-level security to ensure users can only access their own data
  - ✅ Public access for anonymous features

### Testing Strategy
- Focus on diverse geographic locations
- Test with various POI density scenarios
- Verify content quality across different types of locations
- ✅ Test auth flows and user persistence

## Future Considerations

While not part of the MVP, these areas have been identified for potential future development:

- Enhanced user profiles and preferences
- Social sharing features
- Advanced personalization
- Partner integrations
- Monetization strategies
- AR enhancements
- User-contributed content 