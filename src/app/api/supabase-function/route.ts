import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Get Supabase client
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Get session for auth token
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get request body
    const body = await request.json();
    
    // Forward to Supabase function
    const response = await fetch(
      'https://uzqollduvddowyzjvmzn.supabase.co/functions/v1/process-poi',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }
    );
    
    // Get response as JSON or text
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.text();
    }
    
    // Return the proxied response
    return NextResponse.json(
      result,
      { status: response.status }
    );
  } catch (error) {
    console.error('Error in Supabase function proxy:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 