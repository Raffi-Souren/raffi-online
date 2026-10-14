import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { AudioProvider } from "./context/AudioContext"
import GlobalAudioPlayer from "./components/GlobalAudioPlayer"

// The tab stays low-key. The full name lives in the description and the
// structured data, so a search for it still lands here.
const SITE_TITLE = "Raffi Web"
const SITE_DESCRIPTION =
  "Raffi Khatchadourian’s corner of the web: mixes, games, research and a few things in between."
// A real capture of the desktop, so a shared link shows the site rather than a stock wallpaper.
const SHARE_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "Raffi’s desktop at raffi.computer" }
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: SITE_TITLE, alternateName: "raffi.computer", url: "https://raffi.computer/" },
    {
      "@type": "Person",
      name: "Raffi Khatchadourian",
      alternateName: "Raffi",
      jobTitle: "Field CTO & Account Technical Leader",
      worksFor: { "@type": "Organization", name: "IBM" },
      address: { "@type": "PostalAddress", addressLocality: "Brooklyn", addressRegion: "NY", addressCountry: "US" },
      url: "https://raffi.computer/",
      sameAs: ["https://www.raffisourenkhatchadourian.com/", "https://raf94.substack.com/"],
    },
  ],
}

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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
    siteName: "raffi.computer",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
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
        <script
          type="application/ld+json"
          // Static JSON from this file, no user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <AudioProvider>
          <GlobalAudioPlayer />
          {children}
        </AudioProvider>
        <Analytics />
      </body>
    </html>
  )
}
