// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ This will make production console errors show real file/line numbers
  productionBrowserSourceMaps: true,

  images: {
    remotePatterns: [],
  },

  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
