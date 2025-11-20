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
    console.log("🎵 [GlobalAudioPlayer] Component mounted")

    return () => {
      isUnmountingRef.current = true
      console.log("🎵 [GlobalAudioPlayer] Component unmounting")
    }
  }, [])

  useEffect(() => {
    if (currentTrack?.url) {
      console.log("🎵 [GlobalAudioPlayer] Track changed to:", currentTrack.title, currentTrack.url)
      retryCountRef.current = 0
      isUnmountingRef.current = false
    }
  }, [currentTrack?.url])

  const handleError = useCallback(
    (error: any) => {
      // Ignore AbortErrors during unmount (expected behavior)
      if (isUnmountingRef.current && (error?.name === "AbortError" || error?.message?.includes("interrupted"))) {
        console.log("🎵 [GlobalAudioPlayer] Ignoring AbortError during unmount")
        return
      }

      console.error("❌ [GlobalAudioPlayer] Player error:", error)

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        console.log(`🔄 [GlobalAudioPlayer] Retrying... (${retryCountRef.current}/${maxRetries})`)
      } else {
        const errorMessage =
          "Unable to play this track. It may be unavailable, private, or region-restricted. Try shuffling for another track."
        console.error("❌ [GlobalAudioPlayer] Max retries reached.")
        setError(errorMessage)
        setLoading(false)
      }
    },
    [setError, setLoading],
  )

  const handleReady = useCallback(() => {
    console.log("✅ [GlobalAudioPlayer] Player ready")
    setLoading(false)

    if (playerRef.current) {
      try {
        const d = playerRef.current.getDuration?.()
        console.log("⏱️ [GlobalAudioPlayer] Duration:", d)
        if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d) && d > 0) {
          setDuration(d)
        }
      } catch (e) {
        console.error("❌ [GlobalAudioPlayer] Error getting duration:", e)
      }
    }
  }, [setDuration, setLoading])

  const handleStart = useCallback(() => {
    console.log("✅✅✅ [GlobalAudioPlayer] PLAYBACK STARTED!")
    setLoading(false)
    retryCountRef.current = 0
  }, [setLoading])

  const handleProgress = useCallback(
    (progress: { playedSeconds: number }) => {
      if (progress.playedSeconds < 3) {
        console.log("📊 [GlobalAudioPlayer] Progress:", progress.playedSeconds.toFixed(2), "s")
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
    console.log("🏁 [GlobalAudioPlayer] Track ended")
    nextTrack()
  }, [nextTrack])

  if (!mounted || !currentTrack?.url) {
    return null
  }

  console.log("🎵 [GlobalAudioPlayer] Rendering - playing:", isPlaying)

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none",
        zIndex: -9999,
        overflow: "hidden",
        visibility: "hidden",
        display: "none",
      }}
      aria-hidden="true"
    >
      <ReactPlayer
        key={currentTrack.url}
        ref={playerRef}
        url={currentTrack.url}
        playing={isPlaying}
        volume={1}
        width="0"
        height="0"
        progressInterval={500}
        onReady={handleReady}
        onStart={handleStart}
        onPlay={() => console.log("▶️ [GlobalAudioPlayer] onPlay")}
        onPause={() => console.log("⏸️ [GlobalAudioPlayer] onPause")}
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
              visual: true,
            },
          },
        }}
      />
    </div>
  )
}
