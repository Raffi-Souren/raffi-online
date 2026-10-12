/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/raf-os': ['./lib/raf-os-pdf-worker.cjs', './node_modules/pdf-lib/dist/pdf-lib.min.js'],
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        // Single source of truth for security headers (deduped from vercel.json).
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // SAMEORIGIN keeps RAFFI WORLD (a same-origin iframe) working while
            // blocking off-origin framing/clickjacking.
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; frame-src 'self' https://raffi-souren.github.io https://w.soundcloud.com https://api.soundcloud.com https://soundcloud.com https://player.vimeo.com https://vimeo.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://w.soundcloud.com https://connect.soundcloud.com https://player.vimeo.com https://www.youtube.com https://va.vercel-scripts.com;",
          },
        ],
      },
      {
        // EmulatorJS needs its CDN and generated core scripts only inside its
        // dedicated iframe; the portfolio keeps its existing script policy.
        source: '/emulator/:path*',
        headers: [{
          key: 'Content-Security-Policy',
          value: "default-src 'self' blob: data: https://cdn.emulatorjs.org; script-src 'self' blob: 'unsafe-eval' https://cdn.emulatorjs.org; style-src 'self' 'unsafe-inline' https://cdn.emulatorjs.org; worker-src 'self' blob:; frame-ancestors 'self'; object-src 'none'; base-uri 'none';",
        }],
      },
    ]
  },
}

export default nextConfig
