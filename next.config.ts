import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },

  /**
   * ✅ Critical for Next 15 App Router:
   * Prevent server bundler from stubbing Node "fs" in pdfkit/fontkit.
   * Ensures pdfkit runs via real Node require() at runtime (App Hosting + prod build).
   */
  serverExternalPackages: ['pdfkit', 'fontkit', 'qrcode', 'blob-stream'],
};

export default nextConfig;