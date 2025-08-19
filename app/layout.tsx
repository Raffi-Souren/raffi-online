import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Raffi Sourenkhatchadourian - AI Architect & Technology Consultant",
  description:
    "NYC-based AI architect and technology consultant specializing in generative AI transformations, enterprise solutions, and creative technology partnerships.",
  keywords:
    "AI architect, technology consultant, generative AI, IBM, NYC, artificial intelligence, machine learning, enterprise solutions",
  authors: [{ name: "Raffi Sourenkhatchadourian" }],
  creator: "Raffi Sourenkhatchadourian",
  publisher: "Raffi Sourenkhatchadourian",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://raffisourenkhatchadourian.com",
    title: "Raffi Sourenkhatchadourian - AI Architect & Technology Consultant",
    description:
      "NYC-based AI architect and technology consultant specializing in generative AI transformations, enterprise solutions, and creative technology partnerships.",
    siteName: "Raffi Sourenkhatchadourian",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raffi Sourenkhatchadourian - AI Architect & Technology Consultant",
    description:
      "NYC-based AI architect and technology consultant specializing in generative AI transformations, enterprise solutions, and creative technology partnerships.",
  },
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#667eea",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
