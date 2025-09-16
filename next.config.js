/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  // Suppress hydration warnings in development (often caused by browser extensions)
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  compiler: {
    // Temporarily disabled to debug production
    // removeConsole: process.env.NODE_ENV === 'production' ? {
    //   exclude: ['error']
    // } : false,
    removeConsole: false,
  },
}

module.exports = nextConfig
