"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import { useAudio } from "../context/AudioContext"

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack, setCurrentTime, setDuration } = useAudio()
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
        zIndex: -1,
      }}
    >
      <ReactPlayer
        ref={playerRef}
        url={currentTrack?.url || ""}
        playing={isPlaying}
        volume={1}
        width="100%"
        height="100%"
        onEnded={nextTrack}
        onProgress={(p) => {
          // Only update if we have valid numbers
          if (p.playedSeconds !== undefined && !isNaN(p.playedSeconds)) {
            setCurrentTime(p.playedSeconds)
          }
          // Try to get duration from progress if available
          if (playerRef.current) {
            const d = playerRef.current.getDuration()
            if (d && d !== Number.POSITIVE_INFINITY) {
              setDuration(d)
            }
          }
        }}
        onReady={() => {
          setIsReady(true)
          // Safe duration check on ready
          if (playerRef.current) {
            const d = playerRef.current.getDuration()
            if (d && d !== Number.POSITIVE_INFINITY) {
              setDuration(d)
            }
          }
        }}
        onError={(e) => {
          console.error("[Audio Error]", e)
        }}
        config={{
          soundcloud: {
            options: {
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
              visual: true,
            },
          },
          file: {
            attributes: {
              playsInline: true,
            },
          },
        }}
      />
    </div>
  )
}
