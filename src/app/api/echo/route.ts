import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple echo endpoint that returns whatever JSON is sent to it.
 * This is useful for debugging to verify what data is being sent from the client.
 */
export async function POST(request: NextRequest) {
  try {
    // Try to parse the request body as JSON
    const body = await request.json();
    
    // Log the received body for debugging
    console.log('Echo API received:', body);
    
    // Return the same body with a success message
    return NextResponse.json({
      success: true,
      message: 'Echo API received your request',
      receivedData: body,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    // Handle parsing errors
    console.error('Echo API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to parse request body',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}

/**
 * Handle GET requests to test if the API is up
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Echo API is running',
    timestamp: new Date().toISOString(),
  }, { status: 200 });
} 