/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; frame-src 'self' https://w.soundcloud.com https://api.soundcloud.com https://soundcloud.com https://player.vimeo.com https://vimeo.com https://doom-captcha.vercel.app https://dos.zone https://www.retrogames.cc https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://w.soundcloud.com https://connect.soundcloud.com https://player.vimeo.com https://www.youtube.com https://va.vercel-scripts.com;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
