import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"

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
      </head>
      <body className="bg-black text-white overflow-x-hidden font-system">
        {/* XP Background using public path */}
        <div className="fixed inset-0 -z-10 xp-bg" />
        <main>{children}</main>
      </body>
    </html>
  )
}
