/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@carp-partners/api-client', '@carp-partners/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      { protocol: 'https', hostname: '*.vimeocdn.com' },
    ],
  },
};

module.exports = nextConfig;
