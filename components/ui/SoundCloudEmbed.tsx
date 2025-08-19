"use client"

import { useEffect, useRef } from "react"

interface SoundCloudEmbedProps {
  url: string
  title?: string
  height?: number
  color?: string
}

export function SoundCloudEmbed({ url, title, height = 166, color = "ff5500" }: SoundCloudEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    // Ensure iframe loads properly
    if (iframeRef.current) {
      iframeRef.current.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        url,
      )}&color=%23${color}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
    }
  }, [url, color])

  return (
    <div className="w-full">
      <iframe
        ref={iframeRef}
        width="100%"
        height={height}
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        title={title || "SoundCloud player"}
        className="rounded-lg"
      />
    </div>
  )
}
