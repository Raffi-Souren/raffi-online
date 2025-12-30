"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"
import IPodPlayer from "./IPodPlayer"

interface IPodWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function IPodWindow({ isOpen, onClose }: IPodWindowProps) {
  const [expandedVideo, setExpandedVideo] = useState<{ youtubeId: string; title: string } | null>(null)

  if (!isOpen) return null

  const handleExpandVideo = (youtubeId: string, title: string) => {
    setExpandedVideo({ youtubeId, title })
  }

  return (
    <WindowShell title={expandedVideo ? `Video: ${expandedVideo.title}` : "iPod"} onClose={onClose}>
      <div className="flex items-center justify-center p-4" style={{ backgroundColor: "#1a1a2e", minHeight: "520px" }}>
        {expandedVideo ? (
          <div className="w-full max-w-2xl">
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              <iframe
                className="absolute inset-0 w-full h-full rounded"
                src={`https://www.youtube.com/embed/${expandedVideo.youtubeId}?autoplay=1&modestbranding=1&rel=0`}
                title={expandedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex justify-between items-center mt-3">
              <h3 className="text-white font-medium">{expandedVideo.title}</h3>
              <button
                onClick={() => setExpandedVideo(null)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
              >
                ← Back to iPod
              </button>
            </div>
          </div>
        ) : (
          <IPodPlayer onExpandVideo={handleExpandVideo} />
        )}
      </div>
    </WindowShell>
  )
}
