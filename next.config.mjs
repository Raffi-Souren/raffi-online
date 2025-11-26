/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['placeholder.svg', 'via.placeholder.com', 'images.unsplash.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://w.soundcloud.com https://api.soundcloud.com https://soundcloud.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://w.soundcloud.com https://connect.soundcloud.com;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
