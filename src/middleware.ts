import { NextResponse, type NextRequest } from 'next/server';

// Simplified middleware with minimal processing for maximum performance
export async function middleware(request: NextRequest) {
  console.log(`🚪 MIDDLEWARE: Path: ${request.nextUrl.pathname}`);
  
  // OPTIMIZATION #1: Skip API routes completely - they handle auth themselves
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log(`⏩ MIDDLEWARE: Bypassing API route: ${request.nextUrl.pathname}`);
    return NextResponse.next();
  }
  
  // OPTIMIZATION #2: Skip public routes
  const publicRoutes = ['/login', '/auth', '/', '/about', '/saved-tours', '/view-tour'];
  if (publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    console.log(`✅ MIDDLEWARE: Public route, allowing: ${request.nextUrl.pathname}`);
    return NextResponse.next();
  }
  
  // OPTIMIZATION #3: Fast cookie check instead of expensive auth verification
  // For protected routes, just check if auth cookie exists (quick check)
  const hasAuthCookie = request.cookies.getAll()
    .some(cookie => cookie.name.includes('-auth-token'));
  
  // If auth cookie found, allow access without expensive verification
  if (hasAuthCookie) {
    console.log(`🔑 MIDDLEWARE: Auth cookie found, allowing access`);
    return NextResponse.next();
  }
  
  // No auth cookie found, redirect to login
  console.log(`🔒 MIDDLEWARE: No auth cookie, redirecting to login`);
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: [
    // Match all except static resources
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 