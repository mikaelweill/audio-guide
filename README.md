# Audio Guide Tour Application

A Next.js application for creating audio guided tours.

## Audio Guide Feature Testing

We've implemented a test page for the Audio Guide feature at `/test-audio-guide`. This page allows you to:

1. Collect data about a Point of Interest (POI) from Wikipedia and Wikivoyage
2. Generate audio guide content using GPT AI (server-side)
3. Convert the content to speech using OpenAI's TTS API (server-side)
4. Store and play the audio files (using Supabase storage)

### Architecture

The application follows a proper server-side architecture:

1. **Client-side**: Only handles UI and making API calls to the server endpoints
2. **Server-side API endpoints**:
   - `/api/content-generation`: Generates audio content using OpenAI
   - `/api/text-to-speech`: Converts text to speech and stores audio files

This approach keeps API keys secure on the server-side only.

### Testing Requirements

To fully test the audio guide feature, you'll need:

1. An OpenAI API key (for GPT and TTS services)
2. A Supabase project (for authentication and storage)

Add these to your `.env.local` file (see `.env.local.example` for the format).

> **Supabase Storage Setup**: To properly test audio file storage and playback, you need to configure your Supabase project:
> 
> 1. Enable Storage in your Supabase dashboard
> 2. Create an 'audio-guides' bucket with public access
> 3. Configure CORS for your domain (add http://localhost:3000 for local development)
> 4. Ensure your application has the correct Supabase URL and anon key in your .env.local file

### Testing Steps

1. Navigate to `/test-audio-guide`
2. Click on one of the sample POIs to collect data
3. Review the collected data and click "Generate Audio Content"
4. Review the generated content and select a voice
5. Click "Convert to Speech" to create and store the audio files
6. Play the audio files directly in the browser

## Database Schema (Future Implementation)

The audio guide feature will use a `poi_audio` table with the following structure:

```sql
CREATE TABLE public.poi_audio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poi_id TEXT NOT NULL,
  core_audio_url TEXT NOT NULL,
  secondary_audio_url TEXT NOT NULL,
  tertiary_audio_url TEXT NOT NULL,
  sources TEXT[] DEFAULT '{}',
  quality_score INTEGER DEFAULT 1,
  voice TEXT DEFAULT 'nova',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Development

```bash
# Install dependencies
npm install

# Create .env.local file
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
