import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { AudioProvider } from "./context/AudioContext"
import GlobalAudioPlayer from "./components/GlobalAudioPlayer"

export const metadata: Metadata = {
  metadataBase: new URL("https://raffi.computer"),
  title: "Raffi WW Web",
  description: "IBM CTO and entrepreneur based in NYC",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    url: "https://raffi.computer/",
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
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#245DDA",
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
        <Analytics />
      </body>
    </html>
  )
}
