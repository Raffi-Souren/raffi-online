import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { AudioProvider } from "./context/AudioContext"
import GlobalAudioPlayer from "./components/GlobalAudioPlayer"

const SITE_TITLE = "Raffi Khatchadourian | raffi.computer"
const SITE_DESCRIPTION =
  "Field CTO and Account Technical Leader at IBM Financial Services. Research on AI agents, output drift and replayable systems. DJ and BADCOMPANY co-founder in Brooklyn, NY."
// A real capture of the desktop, so a shared link shows the site rather than a stock wallpaper.
const SHARE_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "Raffi’s desktop at raffi.computer" }

export const metadata: Metadata = {
  metadataBase: new URL("https://raffi.computer"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    url: "https://raffi.computer/",
    title: "Raffi Khatchadourian",
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
    siteName: "raffi.computer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raffi Khatchadourian",
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE.url],
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
