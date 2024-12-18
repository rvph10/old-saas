import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.nibblix.com',
      },
    ],
  },
  // Enable React strict mode for better development
  reactStrictMode: true,
};

export default nextConfig;