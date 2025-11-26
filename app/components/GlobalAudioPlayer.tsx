"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { useAudio } from "../context/AudioContext"

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack, setCurrentTime, setDuration, setLoading, setError } = useAudio()
  const [mounted, setMounted] = useState(false)
  const playerRef = useRef<any>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 2
  const isUnmountingRef = useRef(false)

  useEffect(() => {
    setMounted(true)

    return () => {
      isUnmountingRef.current = true
    }
  }, [])

  useEffect(() => {
    if (currentTrack?.url) {
      retryCountRef.current = 0
      isUnmountingRef.current = false
    }
  }, [currentTrack?.url])

  const handleError = useCallback(
    (error: any) => {
      if (isUnmountingRef.current && (error?.name === "AbortError" || error?.message?.includes("interrupted"))) {
        return
      }

      console.log("[v0] Player error:", error, "Track:", currentTrack?.url)

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        console.log("[v0] Retrying...", retryCountRef.current, "/", maxRetries)
      } else {
        const errorMessage =
          "Unable to play this track. It may be unavailable, private, or region-restricted. Try shuffling for another track."
        setError(errorMessage)
        setLoading(false)
      }
    },
    [setError, setLoading, currentTrack?.url],
  )

  const handleReady = useCallback(() => {
    console.log("[v0] Player ready")
    setLoading(false)

    if (playerRef.current) {
      try {
        const d = playerRef.current.getDuration?.()
        console.log("[v0] Duration on ready:", d)
        if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d) && d > 0) {
          setDuration(d)
        }
      } catch (e) {
        // Silently fail
      }
    }
  }, [setDuration, setLoading])

  const handleStart = useCallback(() => {
    console.log("[v0] Player started")
    setLoading(false)
    retryCountRef.current = 0
  }, [setLoading])

  const handleProgress = useCallback(
    (progress: { playedSeconds: number }) => {
      if (progress.playedSeconds < 3) {
        console.log("[v0] Progress:", progress.playedSeconds)
      }

      if (progress.playedSeconds !== undefined && !isNaN(progress.playedSeconds) && progress.playedSeconds >= 0) {
        setCurrentTime(progress.playedSeconds)
      }

      if (playerRef.current) {
        try {
          const d = playerRef.current.getDuration?.()
          if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d) && d > 0) {
            setDuration(d)
          }
        } catch (e) {
          // Silently fail - duration will be retrieved later
        }
      }
    },
    [setCurrentTime, setDuration],
  )

  const handleEnded = useCallback(() => {
    nextTrack()
  }, [nextTrack])

  console.log("[v0] GlobalAudioPlayer render - mounted:", mounted, "track:", currentTrack?.url, "playing:", isPlaying)

  if (!mounted || !currentTrack?.url) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        right: "-500px", // Position just off the right edge
        bottom: "0px",
        width: "400px",
        height: "166px",
        overflow: "visible", // CRITICAL: must be visible for events to fire
        pointerEvents: "none",
        zIndex: -9999,
        opacity: 1, // Full opacity - hidden via position only
        visibility: "visible",
      }}
    >
      <ReactPlayer
        key={currentTrack.url}
        ref={playerRef}
        url={currentTrack.url}
        playing={isPlaying}
        volume={1}
        width="400px"
        height="166px"
        progressInterval={500}
        onReady={handleReady}
        onStart={handleStart}
        onPlay={() => console.log("[v0] onPlay fired")}
        onPause={() => console.log("[v0] onPause fired")}
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
              show_artwork: false,
              show_comments: false,
              show_playcount: false,
              show_user: false,
              show_reposts: false,
              hide_related: true,
              visual: false,
            },
          },
        }}
      />
    </div>
  )
}
