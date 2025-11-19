"use client"

import { useEffect, useState } from "react"
import ReactPlayer from "react-player"
import { useAudio } from "../context/AudioContext"

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack } = useAudio()
  const [mounted, setMounted] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset ready state when track changes to prevent playing before load
  useEffect(() => {
    setIsReady(false)
  }, [currentTrack?.url])

  useEffect(() => {
    if (currentTrack && isPlaying) {
      console.log("[v0] Playing:", currentTrack.url)
    }
  }, [currentTrack, isPlaying])

  if (!mounted) return null

  return (
    <div 
      style={{ 
        position: 'fixed', 
        bottom: 0, 
        right: 0, 
        width: '1px', 
        height: '1px', 
        opacity: 0.001, 
        pointerEvents: 'none', 
        zIndex: -1 
      }}
    >
      <ReactPlayer
        url={currentTrack?.url || ""}
        playing={isPlaying && isReady}
        volume={1}
        width="100%"
        height="100%"
        onEnded={nextTrack}
        onStart={() => console.log("[v0] Audio Started:", currentTrack?.url)}
        onReady={() => {
          console.log("[v0] ReactPlayer ready for:", currentTrack?.url)
          setIsReady(true)
        }}
        onError={(e) => {
          console.error("[v0] Audio error:", e)
        }}
        config={{
          soundcloud: {
            options: {
              auto_play: true,
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
