import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: [
      '@googlemaps/js-api-loader',
      'vaul'
    ]
  }
};

export default nextConfig;


