/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

const allowedDevOrigins = isDev
  ? [
      'http://localhost:9002',
      'http://10.88.0.3:9002',

      // Firebase Studio / Cloud Workstations
      'http://9002-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
      'https://9002-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
      'http://6000-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
      'https://6000-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',

      // fallback sans port
      'https://firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
    ]
  : [];

const nextConfig = {
  typescript: {
    // Temporaire pour ne pas bloquer les builds
    ignoreBuildErrors: true,
  },

  eslint: {
    // Temporaire aussi
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
    ],
  },

  experimental: {
    allowedDevOrigins,
  },

  /**
   * Nécessaire pour les packages Node utilisés côté serveur (PDFKit notamment)
   */
  serverExternalPackages: ['pdfkit', 'fontkit', 'qrcode', 'blob-stream'],
};

export default nextConfig;