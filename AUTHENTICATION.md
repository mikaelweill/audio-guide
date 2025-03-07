# Authentication System

This document explains the authentication architecture used in our Next.js application.

## Overview

We've implemented a layout-based authentication pattern that centralizes auth logic in specialized layouts rather than scattered throughout individual components. This approach reduces code duplication, prevents auth state desynchronization, and provides a better user experience.

## Architecture

### Route Groups

The application is organized using Next.js route groups:

- **`(public)`** - For pages that don't require authentication (login, landing page, etc.)
- **`(protected)`** - For pages that require authentication (dashboard, user profile, etc.)

### Supabase Client Singleton

We use a singleton pattern for the Supabase client to ensure there's only one active instance throughout the application:

```typescript
// src/utils/supabase/client.ts
let supabaseClientInstance: SupabaseClient | null = null

export function createClient() {
  // If an instance already exists, return it
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }
  
  // Create and cache a new instance
  supabaseClientInstance = createBrowserClient(...)
  
  return supabaseClientInstance
}
```

### Authentication Provider

The `AuthProvider` wraps our entire application and provides authentication state and methods to all components:

```typescript
// src/context/AuthContext.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // ... other state and methods
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Layout-Based Auth Protection

Authentication checks happen at the layout level:

```typescript
// src/app/(protected)/layout.tsx
export default function ProtectedLayout({ children }) {
  const { user, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Only render children if authenticated
  return user ? <>{children}</> : null;
}
```

## Authentication Flow

1. **App Initialization**:
   - `AuthProvider` initializes and checks for existing session
   - Auth state is shared throughout the app via context

2. **Protected Routes**:
   - When a user navigates to a protected route, `(protected)/layout.tsx` checks auth
   - If authenticated, the page renders
   - If not authenticated, redirects to login

3. **Login Process**:
   - User enters email for passwordless login
   - OTP is sent to email
   - User enters OTP to complete authentication
   - `AuthContext` updates auth state
   - User is redirected to the intended destination

4. **Logout Process**:
   - `signOut` method in `AuthContext` is called
   - Supabase client signs out
   - Local auth state is cleared
   - Cookies are cleared
   - User is redirected to the login page

## Implementation Details

### Accessing Auth State

In components, access authentication state using the `useAuth` hook:

```typescript
const { user, isLoading, signOut } = useAuth();
```

### Protected API Routes

API routes perform their own authentication checks using the server-side Supabase client.

## Advantages of This Approach

1. **Centralized Auth Logic**: Auth checks happen at the layout level, not in individual components
2. **Reduced Code Duplication**: No need to repeat auth checks across components
3. **Improved Performance**: Pages don't render until auth is confirmed
4. **Better UX**: Loading indicators shown during auth check
5. **Singleton Client**: Prevents competing auth instances and event listeners

## Migration Details

When migrating existing pages to use the new layout-based auth system:

1. Move the page to either `(protected)` or `(public)` route group
2. Remove redundant auth checks from the page component
3. Update any imports using the legacy `src/lib/supabase` to use the singleton pattern 