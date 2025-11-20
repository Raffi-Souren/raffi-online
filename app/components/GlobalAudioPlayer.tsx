"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { useAudio } from "../context/AudioContext"

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack, setCurrentTime, setDuration, setLoading, setError } = useAudio()
  const [mounted, setMounted] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const playerRef = useRef<any>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 2

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset ready state when track changes
  useEffect(() => {
    if (currentTrack?.url) {
      console.log("[GlobalAudioPlayer] Track changed to:", currentTrack.title)
      setIsReady(false)
      setHasStarted(false)
      retryCountRef.current = 0
    }
  }, [currentTrack?.url])

  // Handle loading state
  useEffect(() => {
    if (isPlaying && !isReady && !hasStarted) {
      console.log("[GlobalAudioPlayer] Track is playing but not ready yet - showing loading")
      setLoading(true)
    } else if (isReady || !isPlaying) {
      setLoading(false)
    }
  }, [isPlaying, isReady, hasStarted, setLoading])

  const handleError = useCallback(
    (error: any) => {
      console.error("[GlobalAudioPlayer] Player error:", error)

      // Retry logic for transient errors
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        console.log(`[GlobalAudioPlayer] Retrying... (${retryCountRef.current}/${maxRetries})`)

        // Force a reload by toggling ready state
        setIsReady(false)
        setTimeout(() => {
          setIsReady(true)
        }, 1000)
      } else {
        // Give up after max retries
        const errorMessage = "Unable to play this track. It may be unavailable or region-restricted."
        console.error("[GlobalAudioPlayer] Max retries reached. Error:", errorMessage)
        setError(errorMessage)
        setLoading(false)
      }
    },
    [setError, setLoading],
  )

  const handleReady = useCallback(() => {
    console.log("[GlobalAudioPlayer] Player ready")
    setIsReady(true)
    setLoading(false)

    // Get duration
    if (playerRef.current) {
      const d = playerRef.current.getDuration()
      console.log("[GlobalAudioPlayer] Duration:", d)
      if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d)) {
        setDuration(d)
      }
    }
  }, [setDuration, setLoading])

  const handleStart = useCallback(() => {
    console.log("[GlobalAudioPlayer] Playback started")
    setHasStarted(true)
    setLoading(false)
    retryCountRef.current = 0 // Reset retry count on successful start
  }, [setLoading])

  const handleProgress = useCallback(
    (progress: { playedSeconds: number; played: number; loadedSeconds: number; loaded: number }) => {
      // Update current time
      if (progress.playedSeconds !== undefined && !isNaN(progress.playedSeconds)) {
        setCurrentTime(progress.playedSeconds)
      }

      // Try to get duration if we don't have it yet
      if (playerRef.current) {
        const d = playerRef.current.getDuration()
        if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d)) {
          setDuration(d)
        }
      }
    },
    [setCurrentTime, setDuration],
  )

  const handleEnded = useCallback(() => {
    console.log("[GlobalAudioPlayer] Track ended, playing next")
    setHasStarted(false)
    nextTrack()
  }, [nextTrack])

  if (!mounted) {
    console.log("[GlobalAudioPlayer] Not mounted yet")
    return null
  }

  if (!currentTrack?.url) {
    console.log("[GlobalAudioPlayer] No current track")
    return null
  }

  console.log("[GlobalAudioPlayer] Rendering player - playing:", isPlaying, "ready:", isReady, "url:", currentTrack.url)

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
        key={currentTrack.url} // Force new player instance on track change
        ref={playerRef}
        url={currentTrack.url}
        playing={isPlaying}
        volume={1}
        width="100%"
        height="100%"
        progressInterval={1000}
        onReady={handleReady}
        onStart={handleStart}
        onPlay={() => console.log("[GlobalAudioPlayer] onPlay event")}
        onPause={() => console.log("[GlobalAudioPlayer] onPause event")}
        onBuffer={() => console.log("[GlobalAudioPlayer] Buffering...")}
        onBufferEnd={() => console.log("[GlobalAudioPlayer] Buffer end")}
        onProgress={handleProgress}
        onEnded={handleEnded}
        onError={handleError}
        config={{
          soundcloud: {
            options: {
              auto_play: false,
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
