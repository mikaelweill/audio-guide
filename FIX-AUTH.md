# Authentication Issues Documentation

## The Problem

We're experiencing persistent authentication issues with Supabase in our Next.js application. The issues include:

1. **Page Navigation Problems**: After login, navigating between pages causes timeouts or authentication failures
2. **Cookie Inconsistencies**: Multiple different auth cookies are created with different naming patterns
3. **Session Persistence Issues**: User sessions are not properly maintained between page loads
4. **Auth Timeouts**: Requests to protected endpoints timeout or fail after initial authentication

## Root Cause Analysis

After extensive debugging, we identified several potential causes:

1. **Deprecated Cookie Handling Pattern**: Our code was using the old pattern with individual `get()`, `set()`, and `remove()` methods for cookies, but newer versions of Supabase SSR only support `getAll()` and `setAll()`

2. **Multiple Cookie Implementations**: Different parts of the codebase were handling cookies differently:
   - Middleware used one approach
   - Server components used another
   - Client components used a third

3. **Custom Cookie Names**: We were explicitly setting `AUTH_COOKIE_NAME = 'sb-auth-token'` in multiple files, which conflicts with Supabase's automatic cookie naming

4. **Mixed Auth Flow**: Some parts were using the newer PKCE flow while others weren't specifying

## Attempted Fixes

### Fix #1: Update to newer cookie handling pattern

We updated all Supabase client instances to use the newer cookie pattern with `getAll()` and `setAll()` instead of individual handlers:

```typescript
// OLD PATTERN (BROKEN)
cookies: {
  get(name: string) {
    return cookieStore.get(name)?.value
  },
  set(name: string, value: string) {
    cookieStore.set(name, value)
  },
  remove(name: string) {
    cookieStore.remove(name)
  }
}

// NEW PATTERN
cookies: {
  getAll() {
    return cookieStore.getAll()
  },
  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value, options }) => {
      cookieStore.set(name, value, options)
    })
  }
}
```

Files updated:
- `src/utils/supabase/middleware.ts`
- `src/middleware.ts`
- `src/utils/supabase/server.ts`

### Fix #2: Remove custom cookie names

We removed all explicit cookie name definitions (`AUTH_COOKIE_NAME`) to let Supabase handle cookie naming automatically:

Files updated:
- `src/utils/supabase/middleware.ts`
- `src/middleware.ts`
- `src/utils/supabase/server.ts`
- `src/lib/supabase.ts`

### Fix #3: Standardize auth flow configuration

We ensured all client instances use the same authentication flow configuration:

```typescript
auth: {
  flowType: 'pkce',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
}
```

### Fix #4: Add cookie preservation in middleware

Updated the middleware to properly preserve cookies between different response objects:

```typescript
// Copy all cookies from the updateSession response
response.cookies.getAll().forEach(cookie => {
  supabaseResponse.cookies.set(cookie.name, cookie.value, cookie)
})
```

### Fix #5: Added manual cookie clearing

Added a utility function to manually clear all Supabase cookies when needed:

```typescript
export const clearAllSupabaseCookies = () => {
  if (typeof document === 'undefined') return;
  
  // Get all cookies
  const cookies = document.cookie.split(';');
  
  // Find all Supabase cookies and delete them
  cookies.forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name && name.startsWith('sb-')) {
      // Set expiration to past date to delete
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; ${!isLocalhost ? 'secure; ' : ''}SameSite=Lax`;
      console.log(`🗑️ Deleted cookie: ${name}`);
    }
  });
  
  console.log('🧹 Cleared all Supabase cookies');
};
```

### Fix #6: Added reset functionality to AuthContext

Updated `AuthContext` with a `resetAuthState` function to provide a way to clear cookies and reset auth state:

```typescript
const resetAuthState = async () => {
  try {
    setIsLoading(true);
    
    // First try to sign out normally
    await supabase.auth.signOut();
    
    // Then manually clear all cookies
    clearAllSupabaseCookies();
    
    // Reset local state
    setUser(null);
    setSession(null);
    
    // Reload the page to ensure a fresh state
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Error resetting auth state:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### Fix #7: Added UI for manual auth reset

Added a UI component in the app to allow users to manually reset authentication when errors occur:

```tsx
{tourError && (
  <div className="mb-8 p-4 border border-red-200 bg-red-50 rounded-lg">
    <div className="flex items-center">
      <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <h3 className="text-sm font-medium text-red-800">There was a problem loading your guides</h3>
    </div>
    <div className="mt-2 text-sm text-red-700">
      <p>{tourError}</p>
      <p className="mt-1">This could be due to an authentication issue.</p>
    </div>
    <div className="mt-4">
      <button
        onClick={() => resetAuthState()}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        Reset Authentication
      </button>
    </div>
  </div>
)}
```

## Recent Progress (March 6, 2024)

We've made significant progress in identifying and fixing several critical issues beyond just the auth flow problems:

### Fix #8: Implemented Official Supabase Middleware Pattern

Completely replaced our custom middleware implementation with the official Supabase pattern:

```typescript
export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

This ensures proper cookie handling according to Supabase's latest recommendations.

### Fix #9: Fixed Multiple PrismaClient Instances

Discovered that multiple files were creating their own PrismaClient instances:
- In src/lib/prisma.ts (correctly using global caching)
- In src/app/api/text-to-speech/route.ts (new instance every request)
- In src/app/api/poi-audio/[id]/route.ts (new instance every request)

Fixed by importing the shared client from lib/prisma.ts:

```typescript
// Before
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// After
import prisma from '@/lib/prisma';
```

This prevents connection pool exhaustion which was causing many route timeouts.

### Fix #10: Optimized Database Connection Settings

Updated the DATABASE_URL with improved connection pooling settings:

```
DATABASE_URL="postgres://postgres.uzqollduvddowyzjvmzn:zPwoxRajMzEW1jvS@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20&idle_timeout=10"
```

This ensures:
- Proper usage of pgbouncer for connection pooling
- Reasonable connection limits to prevent exhaustion
- Timeouts to clean up stale connections

### Fix #11: Added Request Timeouts for All Fetch Calls

Added AbortController with timeouts to prevent hanging requests:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

const response = await fetch(`/api/tours/${tourId}`, {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  },
  signal: controller.signal // Use the abort controller
});

// Clear timeout since request completed
clearTimeout(timeoutId);
```

This prevents the UI from getting stuck when API requests hang.

### Fix #12: Fixed Race Conditions in Data Fetching

Added mechanisms to prevent multiple simultaneous requests to the same endpoints:

```typescript
// Set a flag to prevent multiple simultaneous fetches
let isFetching = false;

const fetchToursOnReturn = async () => {
  // Prevent multiple simultaneous fetches
  if (isFetching) {
    console.log('Already fetching tours, skipping duplicate request');
    return;
  }
  
  isFetching = true;
  setIsLoadingTours(true);
  
  try {
    // fetch code...
  } finally {
    setIsLoadingTours(false);
    isFetching = false;
  }
};
```

### Fix #13: Simplified Tour API Implementation

Significantly simplified the `/api/tours/[id]` route implementation:
- Removed complex fallback patterns
- Added better error handling and timing information
- Added more detailed logging to trace issues

```typescript
// First, just check if the tour exists at all
const tourExists = await prisma.tour.findUnique({
  where: { id: tourId },
  select: { id: true }
});

console.log(`⭐️ Tour ID API: Tour exists check: ${!!tourExists}`);

if (!tourExists) {
  console.log(`⭐️ Tour ID API: Tour with ID ${tourId} not found`);
  console.timeTime('tour-api-timer');
  return NextResponse.json({ 
    success: false, 
    error: 'Tour not found' 
  }, { status: 404 });
}

// Now fetch the full tour with related data
const tour = await prisma.tour.findFirst({
  where: {
    id: tourId,
    user_id: userId
  },
  include: {
    tourPois: {
      include: {
        poi: true
      },
      orderBy: {
        sequence_number: 'asc'
      }
    }
  }
});
```

## Latest Analysis - Deeper Architectural Issues (March 8, 2024)

Despite our previous fixes, we're still experiencing persistent authentication issues. After additional investigation, we've discovered **fundamental architectural issues** in how the application handles authentication:

### Critical Issue #1: Multiple Competing Supabase Clients

We have **two separate Supabase browser client implementations**:
- `src/lib/supabase.ts` - Creates and exports a direct instance of `supabase`
- `src/utils/supabase/client.ts` - A singleton factory function that creates its own instance

These two client implementations are **creating separate auth state instances and event listeners**, leading to conflicts in cookie management and auth state synchronization.

### Critical Issue #2: Navigation and Auth State Synchronization

The navigation flow when authentication changes is inconsistent:
- `AuthContext` uses hard navigation (`window.location.href`) for sign-out
- Tour pages use client-side navigation with Next.js router
- Auth errors in API calls don't properly redirect back to login

This inconsistency creates situations where:
1. The tour page starts loading before middleware redirects
2. The API call to fetch tour data fails with 401 unauthorized
3. The page is left in a perpetual loading state with a spinner

### Critical Issue #3: Improper Error Handling in Tour Pages

Tour pages don't properly handle authentication errors:
```typescript
// Missing redirect for auth errors
if (response.status === 401) {
  console.error('Authentication error - not logged in or session expired');
  setError('Authentication error: You need to log in again');
  // The next line is commented out, preventing redirect
  // router.push('/login');
  setLoading(false);
  return;
}
```

### Critical Issue #4: Sign Out Process is Incomplete

The logout functionality doesn't properly:
1. Clear all auth state
2. Properly handle the redirect
3. Wait for Supabase sign-out to complete before redirecting

## Complete Solution - Step by Step Plan

### Step 1: Consolidate Supabase Client Implementations

We need to **eliminate the duplicate Supabase client** situation by:

1. **Delete** the `src/lib/supabase.ts` file entirely
2. Update all imports to use the singleton pattern from `utils/supabase/client.ts`
3. Ensure all components use the same client instance:

```typescript
// Replace all direct imports from lib
import { supabase } from '@/lib/supabase';

// With the singleton factory
import { createClient } from '@/utils/supabase/client';
const supabase = createClient();
```

### Step 2: Fix AuthContext Dependencies

Update `AuthContext.tsx` to:
1. Use the singleton Supabase client pattern
2. Only set up **one** auth state change listener 
3. Ensure auth state updates are batched properly
4. Properly handle navigation on sign-out

```typescript
// Fix auth context imports
import { createClient } from '@/utils/supabase/client';

// Inside AuthProvider component:
const supabase = createClient();
```

### Step 3: Update Sign Out Process

Completely rewrite the sign-out function:

```typescript
const signOut = async () => {
  try {
    console.log('Sign out process starting');
    setIsLoading(true);
    
    // 1. Clear React state immediately
    setUser(null);
    setSession(null);
    
    // 2. Call Supabase signOut but don't await it
    const signOutPromise = supabase.auth.signOut();
    
    // 3. Aggressively clear cookies while the API call happens
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      
      cookies.forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
        }
      });
    }
    
    // 4. Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    
    // 5. Complete the API call if still running
    try {
      await signOutPromise;
    } catch (e) {
      console.error('Error in Supabase signOut (continuing with redirect):', e);
    }
    
    // 6. Force redirect to login page
    if (typeof window !== 'undefined') {
      // Set a flag to avoid redirect loops
      sessionStorage.setItem('manual_logout', 'true');
      // Hard redirect (not router.push)
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Error during sign out:', error);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
};
```

### Step 4: Fix Tour Page Error Handling

Update the tour pages to properly handle auth errors:

```typescript
// Update the tour fetch function
const fetchTour = async () => {
  // ...existing code...
  
  if (!response.ok) {
    // Handle authentication errors properly
    if (response.status === 401) {
      console.error('Authentication error - not logged in or session expired');
      setError('Authentication error: You need to log in again');
      
      // UNCOMMENT THIS LINE to enable proper redirect
      router.push('/login');
      
      setLoading(false);
      return;
    }
    // ...rest of error handling...
  }
  
  // ...rest of function...
};
```

### Step 5: Improve Navigation Between Pages

Add a global error boundary to catch authentication issues:

```tsx
// Create src/components/AuthErrorBoundary.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AuthErrorBoundary({ children }) {
  const [error, setError] = useState(null);
  const router = useRouter();
  
  // Monitor for auth errors
  useEffect(() => {
    const supabase = createClient();
    
    // Check session on mount
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setError('Authentication error');
        router.push('/login');
      }
    };
    
    checkSession();
    
    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setError('You have been signed out');
        router.push('/login');
      }
    });
    
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }
  
  return children;
}
```

### Step 6: Simplify Middleware

Simplify middleware to focus on fast cookie checks, not full authentication:

```typescript
export async function middleware(request: NextRequest) {
  // Skip API routes and public routes
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname === '/'
  ) {
    return NextResponse.next();
  }
  
  // Fast cookie check - just look for existence of auth cookie
  const hasAuthCookie = request.cookies.getAll()
    .some(cookie => cookie.name.includes('-auth-token'));
    
  if (hasAuthCookie) {
    return NextResponse.next();
  }
  
  // No auth cookie, redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}
```

### Step 7: Add Debug Tools for Authentication

Create a debug component to display auth state:

```tsx
// Create src/components/AuthDebug.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function AuthDebug() {
  const [expanded, setExpanded] = useState(false);
  const [authInfo, setAuthInfo] = useState(null);
  
  const checkAuth = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    
    setAuthInfo({
      hasSession: !!data.session,
      userId: data.session?.user?.id || 'none',
      email: data.session?.user?.email || 'none',
      error: error?.message || null,
      cookies: document.cookie.split(';').map(c => c.trim())
    });
  };
  
  if (!expanded) {
    return (
      <button 
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full"
      >
        🔐
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 w-80">
      <div className="flex justify-between mb-2">
        <h3 className="font-bold">Auth Debug</h3>
        <button onClick={() => setExpanded(false)}>✕</button>
      </div>
      
      <button 
        onClick={checkAuth}
        className="w-full bg-blue-500 text-white py-2 rounded mb-2"
      >
        Check Auth State
      </button>
      
      {authInfo && (
        <div className="text-xs overflow-auto max-h-60">
          <p>Has Session: {String(authInfo.hasSession)}</p>
          <p>User ID: {authInfo.userId}</p>
          <p>Email: {authInfo.email}</p>
          {authInfo.error && <p className="text-red-500">Error: {authInfo.error}</p>}
          
          <div className="mt-2">
            <p className="font-bold">Cookies:</p>
            <ul className="list-disc pl-4">
              {authInfo.cookies.map((cookie, i) => (
                <li key={i} className="truncate">{cookie}</li>
              ))}
            </ul>
          </div>
          
          <button
            onClick={() => {
              const supabase = createClient();
              supabase.auth.signOut().then(() => {
                window.location.href = '/login';
              });
            }}
            className="w-full bg-red-500 text-white py-1 rounded mt-2"
          >
            Force Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
```

### Implementation Order

For maximum efficiency, implement these changes in this order:

1. **First**: Fix Supabase client consolidation
2. **Second**: Update the sign-out function
3. **Third**: Fix tour page error handling
4. **Fourth**: Improve middleware
5. **Fifth**: Add debug tools
6. **Sixth**: Add auth error boundary

This comprehensive plan addresses all the authentication issues we've identified by fixing the underlying architectural problems. By consolidating authentication code and properly handling auth state changes, we can eliminate the infinite loading spinners, navigation issues, and sign-out problems we've been experiencing. 