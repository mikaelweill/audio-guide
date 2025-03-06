import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Initialize OpenAI client (server-side only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    // TEMPORARILY DISABLED FOR TESTING
    // In production, you should re-enable this authentication check
    /*
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    */
    
    // Get request body
    const { poiData } = await request.json();
    
    if (!poiData || !poiData.basic || !poiData.basic.name) {
      return NextResponse.json(
        { error: 'Invalid POI data. Must include basic information.' },
        { status: 400 }
      );
    }
    
    // Generate content (core layer)
    const coreContent = await generateCoreContent(poiData);
    
    // Generate secondary content
    const secondaryContent = await generateSecondaryContent(poiData, coreContent);
    
    // Generate tertiary content
    const tertiaryContent = await generateTertiaryContent(
      poiData, 
      coreContent + "\n\n" + secondaryContent
    );
    
    // Generate credits
    const credits = generateCredits(poiData);
    
    return NextResponse.json({
      content: {
        core: coreContent,
        secondary: secondaryContent,
        tertiary: tertiaryContent,
        credits: credits
      }
    });
  } catch (error: any) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate content' },
      { status: 500 }
    );
  }
}

// Helper functions for content generation
async function generateCoreContent(poiData: any): Promise<string> {
  const prompt = `
    Create a concise 30-60 second audio guide script about "${poiData.basic.name}".
    Focus only on the most important and interesting facts.
    Use a conversational, engaging tone as if speaking to a tourist.
    Include only essential historical context, significance, and main features.
    
    Use this information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract.substring(0, 500)}...` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide: ${poiData.wikivoyage.seeSection.substring(0, 500)}...` : ''}
    ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract.substring(0, 300)}...` : ''}
    
    The script should be brief but insightful, about 100-150 words total.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert tour guide creating audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  
  return response.choices[0].message.content || '';
}

async function generateSecondaryContent(poiData: any, coreContent: string): Promise<string> {
  const prompt = `
    Create an additional 1-2 minute audio guide script for "${poiData.basic.name}" that builds upon this core content:
    
    "${coreContent}"
    
    This secondary content should:
    - Provide more details about architectural features, artistic significance, or historical events
    - Include interesting anecdotes or lesser-known facts
    - Explain cultural context or impact
    - Offer more detailed descriptions
    
    Use this additional information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide (See section): ${poiData.wikivoyage.seeSection}` : ''}
    ${poiData.wikivoyage?.doSection ? `Travel guide (Do section): ${poiData.wikivoyage.doSection}` : ''}
    
    The script should be about 250-300 words in a conversational style, as if speaking directly to a tourist.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert tour guide creating detailed audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  return response.choices[0].message.content || '';
}

async function generateTertiaryContent(poiData: any, previousContent: string): Promise<string> {
  const prompt = `
    Create an extended 3+ minute audio guide script for "${poiData.basic.name}" that provides deep context beyond this previous content:
    
    "${previousContent.substring(0, 300)}..."
    
    This tertiary content should:
    - Provide in-depth historical analysis 
    - Share detailed stories and significant events connected to this place
    - Examine cultural impact and significance in depth
    - Discuss artistic or architectural details
    - Mention connections to other important sites or historical figures
    - Include interesting debates or different perspectives about this place
    
    Use all available information:
    ${poiData.wikipedia?.extract ? `Wikipedia: ${poiData.wikipedia.extract}` : ''}
    ${poiData.wikivoyage?.extract ? `About the area: ${poiData.wikivoyage.extract}` : ''}
    ${poiData.wikivoyage?.seeSection ? `Travel guide (See): ${poiData.wikivoyage.seeSection}` : ''}
    ${poiData.wikivoyage?.doSection ? `Travel guide (Do): ${poiData.wikivoyage.doSection}` : ''}
    
    The script should be 500-600 words in a conversational, engaging style.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert historian and tour guide creating in-depth audio scripts for famous locations." },
      { role: "user", content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });
  
  return response.choices[0].message.content || '';
}

function generateCredits(poiData: any): string {
  const credits = ['Information provided by:'];
  
  if (poiData.wikipedia) {
    credits.push(`Wikipedia: "${poiData.wikipedia.title}" - ${poiData.wikipedia.url}`);
  }
  
  if (poiData.wikivoyage) {
    credits.push(`Wikivoyage: "${poiData.wikivoyage.title}" - ${poiData.wikivoyage.url}`);
  }
  
  return credits.join('\n');
}