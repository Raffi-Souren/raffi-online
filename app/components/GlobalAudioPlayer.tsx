"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import { useAudio } from "../context/AudioContext"

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack, playTrack } = useAudio()
  const [mounted, setMounted] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const playerRef = useRef<any>(null)

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
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "1px",
        height: "1px",
        opacity: 0.001,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <ReactPlayer
        ref={playerRef}
        url={currentTrack?.url || ""}
        playing={isPlaying} // Removed && isReady to force play attempt
        volume={1}
        width="100%"
        height="100%"
        onEnded={nextTrack}
        onStart={() => console.log("[v0] Audio Started:", currentTrack?.url)}
        onProgress={(p) => console.log("[v0] Progress:", p.playedSeconds)} // Added progress logging
        onReady={() => {
          console.log("[v0] ReactPlayer ready for:", currentTrack?.url)
          setIsReady(true)
        }}
        onError={(e) => {
          console.error("[Audio Error]", e)
        }}
        config={{
          soundcloud: {
            options: {
              auto_play: true,
              buying: false,
              liking: false,
              download: false,
              sharing: false,
              show_artwork: true,
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
