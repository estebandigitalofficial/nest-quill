import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" warning — the pnpm-lock.yaml is correct
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
    ],
  },
}

export default nextConfig
