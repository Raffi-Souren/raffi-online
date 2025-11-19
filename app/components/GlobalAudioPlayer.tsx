"use client"

import { useEffect, useState } from "react"
import ReactPlayer from "react-player"
import { useAudio } from "../context/AudioContext"

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack } = useAudio()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {/* Use track ID as key to force remount on track change, preventing AbortError */}
      <ReactPlayer
        key={currentTrack?.id || 'no-track'}
        url={currentTrack?.url || ""}
        playing={!!currentTrack && isPlaying}
        volume={1}
        width="0"
        height="0"
        onEnded={nextTrack}
        onError={(e) => {
          console.error("[v0] Audio error:", e)
        }}
        config={{
          soundcloud: {
            options: {
              auto_play: false,
              visual: false,
              buying: false,
              liking: false,
              download: false,
              sharing: false,
              show_artwork: false,
              show_comments: false,
              show_playcount: false,
              show_user: false,
              show_reposts: false,
              hide_related: true,
            },
          },
        }}
      />
    </div>
  )
}
