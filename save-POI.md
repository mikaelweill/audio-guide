# Tour Data Storage Strategy

## Overview
This document outlines our strategy for storing tour data in the database, with the goal of minimizing Google API calls while maintaining a good user experience. We'll use a hybrid approach where essential data is always stored, while some dynamic data might be refreshed occasionally.

## Technology Stack
We will use Supabase as our database backend with Prisma as our ORM layer:

- **Supabase**: Provides PostgreSQL database with authentication and storage features
- **Prisma**: Offers type-safe database access, migrations, and database abstraction

This combination gives us several advantages:
1. Type safety and auto-completion when accessing database
2. Easy schema migrations through Prisma
3. Database portability if we need to switch providers in the future
4. Supabase's additional features like authentication and storage

## Data Storage Approach

### Core Tour Data (Always Stored)
1. **Tour Metadata**
   - ID, name, description
   - Creation date and last updated timestamp
   - Duration, distance
   - User preferences (interests, transportation mode)
   - Start/end locations with coordinates

2. **POI List**
   - Ordered sequence of POIs
   - Relationship between tour and POIs

3. **Route Information**
   - Calculated distances between consecutive POIs
   - Calculated travel times
   - Total tour statistics (walking distance, time, etc.)
   - Google Maps deeplink for the entire route

### POI Data (Always Stored)
1. **Essential POI Information**
   - Google place_id (for potential refreshes)
   - Name
   - Coordinates (lat/lng)
   - Types/categories
   - Vicinity (short address)
   - Rating and rating count (at time of creation)
   - One primary thumbnail image (downloaded and stored)
   - Formatted address
   - Google Maps URL for this specific POI

2. **Extended POI Details**
   - Website URL
   - Phone number
   - Price level
   - Opening hours as of tour creation
   - Last updated timestamp

### Dynamically Refreshable Data
The following data may be refreshed occasionally:
1. Opening hours
2. Ratings
3. Additional photos (beyond primary thumbnail)

## Implementation Details

### Prisma Schema

```prisma
// Define the Prisma schema for our database

model User {
  id         String   @id @default(uuid())
  email      String   @unique
  created_at DateTime @default(now())
  tours      Tour[]
}

model Tour {
  id                String    @id @default(uuid())
  user_id           String
  name              String
  description       String?
  created_at        DateTime  @default(now())
  last_updated_at   DateTime  @updatedAt
  start_location    Json      // {lat: number, lng: number, address: string}
  end_location      Json      // {lat: number, lng: number, address: string}
  return_to_start   Boolean   @default(false)
  transportation_mode String  
  total_distance    Float     // in km
  total_duration    Int       // in minutes
  google_maps_url   String?
  preferences       Json      // {interests: string[], etc.}
  
  // Relations
  user              User      @relation(fields: [user_id], references: [id])
  tourPois          TourPoi[]
}

model Poi {
  id                String    @id @default(uuid())
  place_id          String    @unique    // Google place_id  
  name              String
  vicinity          String?
  formatted_address String
  location          Json      // {lat: number, lng: number}
  types             Json      // string[]
  rating            Float?
  user_ratings_total Int?
  website           String?
  phone_number      String?
  price_level       Int?
  opening_hours     Json?
  google_maps_url   String?
  thumbnail_url     String?
  photo_references  Json?     // string[]
  last_updated_at   DateTime  @updatedAt
  
  // Relations
  tourPois          TourPoi[]
}

model TourPoi {
  id               String    @id @default(uuid())
  tour_id          String
  poi_id           String
  sequence_number  Int
  distance_to_next Float?    // in km
  time_to_next     Int?      // in seconds
  custom_notes     String?
  
  // Relations
  tour             Tour      @relation(fields: [tour_id], references: [id], onDelete: Cascade)
  poi              Poi       @relation(fields: [poi_id], references: [id])
  
  // Unique constraint to ensure no duplicate POIs in the same tour
  @@unique([tour_id, poi_id])
  // Index for faster queries by tour
  @@index([tour_id])
}
```

### Google Maps Deep Links
1. **Full Route Link**:
   ```
   https://www.google.com/maps/dir/?api=1&origin=LAT1,LNG1&destination=LAT2,LNG2&waypoints=LAT3,LNG3|LAT4,LNG4&travelmode=walking
   ```

2. **Individual POI Link**:
   ```
   https://www.google.com/maps/search/?api=1&query=LAT,LNG&query_place_id=PLACE_ID
   ```

### Image Storage
1. Download and store one primary thumbnail image for each POI
2. Keep the photo references for additional photos
3. If a user views detailed POI information, fetch additional photos on demand

### Integrating with Supabase

Since we're using Prisma as our ORM, we'll connect it to Supabase's PostgreSQL database:

1. **Database URL Configuration**:
   ```
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"
   ```

2. **Supabase Services**:
   - Use Supabase Auth for user authentication
   - Use Supabase Storage for storing POI images
   - Use Prisma for all database operations

3. **Image Storage with Supabase**:
   - Create a `poi-images` bucket in Supabase Storage
   - Store thumbnail images with format: `{poi_id}/{timestamp}.jpg`
   - Set appropriate security policies for access control

4. **Storage Policies**:
   - Create a policy named "Allow authenticated users to access POI images"
   - Enable all operations (SELECT, INSERT, UPDATE, DELETE)
   - Use the policy definition: `bucket_id = 'poi-images' AND auth.role() = 'authenticated'`
   - This ensures only authenticated users can access images stored in the bucket
   - For more granular control, we can later add user-specific access checks

### Database Migrations

We'll use Prisma's migration system to manage database schema changes:

1. Generate initial migration: `npx prisma migrate dev --name init`
2. Apply migrations in production: `npx prisma migrate deploy`

This approach gives us version control over our database schema and safe upgrades.

### Refresh Strategy
1. **User-Initiated Refresh**
   - Provide a "Refresh Tour Data" button for users
   - Update all POI data when pressed

2. **Time-Based Refresh**
   - If a tour hasn't been refreshed in 30+ days AND a user views it
   - Add an indicator showing data age when older than 7 days

3. **Pre-Travel Refresh**
   - If we implement a "scheduled tour" feature, refresh 1-2 days before

## Implementation Phases

### Phase 1: Basic Storage
1. Implement the database schema
2. Store all core tour and POI data
3. Generate and store Google Maps deeplinks
4. Download and store primary thumbnail images

### Phase 2: User Experience
1. Add "data age" indicators
2. Implement refresh button
3. Add on-demand loading for additional photos

### Phase 3: Advanced Features (Future)
1. Tour scheduling with pre-travel refresh
2. Offline mode support
3. Analytics on most viewed POIs

## API Costs Consideration
For typical tours (5-7 POIs):
- Place Details: ~$0.004 per POI
- Photos: ~$0.007 per photo
- Total refresh cost: ~$0.02-0.04 per tour

This makes occasional refreshes very reasonable from a cost perspective. 