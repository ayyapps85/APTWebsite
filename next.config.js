/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isProd ? '/APTWebsite' : '',
  assetPrefix: isProd ? '/APTWebsite' : '',
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