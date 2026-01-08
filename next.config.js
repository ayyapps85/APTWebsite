/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/APTWebsite' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/APTWebsite/' : '',
  images: {
    unoptimized: true
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "undici": false,
    };
    return config;
  },
  experimental: {
    esmExternals: 'loose'
  }
}

module.exports = nextConfig