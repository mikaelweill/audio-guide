/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  // Ensure API routes are handled properly
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          }
        ],
      },
    ];
  },
}

module.exports = nextConfig 