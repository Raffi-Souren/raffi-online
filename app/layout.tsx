import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Raffi Sourenkhatchadourian",
  description: "NYC-based AI architect and technology consultant",
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Speed up third-party embeds */}
        <link rel="preconnect" href="https://w.soundcloud.com" crossOrigin="" />
        <link rel="preconnect" href="https://soundcloud.com" crossOrigin="" />
        <link rel="preconnect" href="https://i1.sndcdn.com" crossOrigin="" />
        {/* Preload wallpaper */}
        <link rel="preload" as="image" href="/windows-2000-background.png" fetchPriority="high" />
      </head>
      <body className="bg-black text-white overflow-x-hidden">
        {/* Critical wallpaper - render above the fold */}
        <Image
          src="/windows-2000-background.png"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-center -z-10 pointer-events-none select-none"
          quality={85}
        />
        <main>{children}</main>
      </body>
    </html>
  )
}
