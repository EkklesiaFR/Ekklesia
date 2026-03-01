/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
        { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
        { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      ],
    },
  
    allowedDevOrigins: [
      'https://9000-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
      'https://9002-firebase-studio-1771938666482.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
    ],
  
    serverExternalPackages: ['pdfkit', 'fontkit', 'qrcode', 'blob-stream'],
  };
  
  export default nextConfig;