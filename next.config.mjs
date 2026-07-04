/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h for optimised images
  },
  // Strip unused locales — smaller bundle
  i18n: undefined,
  // Strict mode catches double-render bugs in dev without hurting prod
  reactStrictMode: true,
};

export default nextConfig;
