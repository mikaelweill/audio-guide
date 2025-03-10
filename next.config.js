/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable strict mode to prevent double-rendering that causes auth issues
  reactStrictMode: false,
  images: {
    domains: ['maps.googleapis.com', 'lh3.googleusercontent.com'],
  },
  // Disable ESLint during production build
  eslint: {
    // Warning: This disables ESLint checks during production build
    // Only use this for deployment if you're handling linting separately
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during build
  typescript: {
    // Warning: This disables TypeScript type checking during production build
    // Only use this for deployment if you're handling type checking separately
    ignoreBuildErrors: true,
  },
  // Improve caching for better navigation
  async headers() {
    return [
      {
        // API routes - no caching
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          }
        ],
      },
      {
        // Static assets - cache aggressively
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          }
        ],
      },
      {
        // Regular pages - allow some caching
        source: '/((?!api|_next/static).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          }
        ],
      },
    ];
  },
}

module.exports = nextConfig 