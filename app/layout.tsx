import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AudioProvider } from "./context/AudioContext"
import GlobalAudioPlayer from "./components/GlobalAudioPlayer"

export const metadata: Metadata = {
  title: "Raffi WW Web",
  description: "IBM CTO and entrepreneur based in NYC",
  openGraph: {
    type: "website",
    url: "https://raffi-souren.vercel.app/",
    title: "Raffi Web",
    description: "IBM CTO and entrepreneur based in NYC",
    images: [
      {
        url: "/windows-2000-background.png",
        alt: "Windows XP desktop background",
      },
    ],
    siteName: "Raffi Web",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raffi Web",
    description: "IBM CTO and entrepreneur based in NYC",
    images: ["/windows-2000-background.png"],
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className="font-sans antialiased"
        style={{
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <AudioProvider>
          <GlobalAudioPlayer />
          {children}
        </AudioProvider>
      </body>
    </html>
  )
}
