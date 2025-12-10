// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Configure external images here if you use them.
  // Remove/keep empty if you only serve local images.
  images: {
    remotePatterns: [
      // Example:
      // { protocol: 'https', hostname: 'images.unsplash.com' },
      // { protocol: 'https', hostname: 'itsreadyroster.com' },
    ],
  },

  // On Next 14, typedRoutes is under `experimental`.
  // Delete this block if you don't want typed route checks.
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
