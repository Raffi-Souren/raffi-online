import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Events - Raffi Web",
  description: "Speaking engagements, talks, and panels on AI, technology, and the future of work",
  openGraph: {
    title: "Events - Raffi Web",
    description: "Speaking engagements, talks, and panels on AI, technology, and the future of work",
  },
}

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
