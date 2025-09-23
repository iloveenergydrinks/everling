/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['discord.js', '@discordjs/ws', 'zlib-sync', 'bufferutil', 'utf-8-validate']
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these modules for the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        stream: false,
        zlib: false,
      }
      
      // Ignore native modules on client side
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
        'zlib-sync': 'commonjs zlib-sync'
      })
    }
    
    // Handle .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    })
    
    return config
  },
}

module.exports = nextConfig