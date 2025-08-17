import type React from "react"
import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Raffi Sourenkhatchadourian",
  description: "NYC-based AI architect and technology consultant",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-black text-white">
        <main>{children}</main>
      </body>
    </html>
  )
}
