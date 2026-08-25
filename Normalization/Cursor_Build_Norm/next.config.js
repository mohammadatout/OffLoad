/** @type {import('next').NextConfig} */

// The matcher API port is configurable because 8000 is often already taken by
// other local tooling. Keep this in sync with OFFLOAD_MATCHER_PORT.
const MATCHER_ORIGIN = process.env.MATCHER_API_ORIGIN ?? 'http://localhost:8010';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/matcher/:path*',
        destination: `${MATCHER_ORIGIN}/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
