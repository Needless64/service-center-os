import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  images: {
    remotePatterns: [{ hostname: 'cdn.sanity.io' }],
  },
}

export default nextConfig
