import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Raffi WW Web",
  description: "AI Architect & Technology Consultant based in New York City.",
  openGraph: {
    type: "website",
    url: "https://raffi-souren.vercel.app/",
    title: "Raffi Web",
    description: "AI Architect & Technology Consultant based in New York City.",
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
    description: "AI Architect & Technology Consultant based in New York City.",
    images: ["/windows-2000-background.png"],
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
