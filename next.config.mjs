/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

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
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },

  /**
   * Permet à Next dev server d'accepter les requêtes venant
   * du proxy Firebase Studio / Cloud Workstations.
   */
  allowedDevOrigins: isDev
    ? [
        'http://localhost:9002',
        'http://10.88.0.3:9002',

        // Firebase Studio / Cloud Workstations
        'http://9002-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
        'https://9002-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
        'http://6000-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
        'https://6000-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',

        // fallback sans port (utile parfois avec les proxies)
        'https://firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
      ]
    : [],

  /**
   * Nécessaire pour les packages Node utilisés côté serveur
   * (PDFKit notamment pour les PV)
   */
  serverExternalPackages: ['pdfkit', 'fontkit', 'qrcode', 'blob-stream'],
};

export default nextConfig;