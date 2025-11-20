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
  const [internalPlaying, setInternalPlaying] = useState(false)
  const playerRef = useRef<any>(null)
  const retryCountRef = useRef(0)
  const maxRetries = 2
  const playAttemptRef = useRef(0)

  useEffect(() => {
    setMounted(true)
    console.log("🎵 [GlobalAudioPlayer] Component mounted")
  }, [])

  // Reset ready state when track changes
  useEffect(() => {
    if (currentTrack?.url) {
      console.log("🎵 [GlobalAudioPlayer] Track changed to:", currentTrack.title, currentTrack.url)
      setIsReady(false)
      setHasStarted(false)
      setInternalPlaying(false)
      retryCountRef.current = 0
      playAttemptRef.current = 0
    }
  }, [currentTrack?.url])

  // Sync playing state - trigger play on user interaction
  useEffect(() => {
    if (isPlaying && isReady && !internalPlaying) {
      playAttemptRef.current++
      console.log(`🎵 [GlobalAudioPlayer] Attempt #${playAttemptRef.current} - Starting playback after ready state`)
      console.log("🎵 [GlobalAudioPlayer] Player ref exists:", !!playerRef.current)
      setInternalPlaying(true)
    } else if (!isPlaying && internalPlaying) {
      console.log("⏸️ [GlobalAudioPlayer] Pausing playback")
      setInternalPlaying(false)
    }
  }, [isPlaying, isReady, internalPlaying])

  // Handle loading state
  useEffect(() => {
    if (isPlaying && !isReady && !hasStarted) {
      console.log("⏳ [GlobalAudioPlayer] Track is playing but not ready yet - showing loading")
      setLoading(true)
    } else if (isReady || !isPlaying) {
      setLoading(false)
    }
  }, [isPlaying, isReady, hasStarted, setLoading])

  const handleError = useCallback(
    (error: any) => {
      console.error("❌ [GlobalAudioPlayer] Player error:", error)
      console.error("❌ [GlobalAudioPlayer] Error type:", typeof error, error?.message)

      // Retry logic for transient errors
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        console.log(`🔄 [GlobalAudioPlayer] Retrying... (${retryCountRef.current}/${maxRetries})`)

        // Force a reload by toggling ready state
        setIsReady(false)
        setInternalPlaying(false)
        setTimeout(() => {
          setIsReady(true)
        }, 1000)
      } else {
        // Give up after max retries
        const errorMessage = "Unable to play this track. It may be unavailable or region-restricted."
        console.error("❌ [GlobalAudioPlayer] Max retries reached. Error:", errorMessage)
        setError(errorMessage)
        setLoading(false)
      }
    },
    [setError, setLoading],
  )

  const handleReady = useCallback(() => {
    console.log("✅ [GlobalAudioPlayer] Player ready event fired")
    console.log("🎵 [GlobalAudioPlayer] Player ref:", playerRef.current)
    console.log("🎵 [GlobalAudioPlayer] Should be playing:", isPlaying)
    setIsReady(true)
    setLoading(false)

    // Get duration
    if (playerRef.current) {
      try {
        const d = playerRef.current.getDuration()
        console.log("⏱️ [GlobalAudioPlayer] Duration from player:", d)
        if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d)) {
          setDuration(d)
        }
      } catch (e) {
        console.error("❌ [GlobalAudioPlayer] Error getting duration:", e)
      }
    }

    // If we should be playing, trigger play now
    if (isPlaying && !internalPlaying) {
      console.log("▶️ [GlobalAudioPlayer] Auto-starting playback after ready")
      setInternalPlaying(true)
    }
  }, [setDuration, setLoading, isPlaying, internalPlaying])

  const handleStart = useCallback(() => {
    console.log("✅✅✅ [GlobalAudioPlayer] PLAYBACK STARTED SUCCESSFULLY!")
    setHasStarted(true)
    setLoading(false)
    retryCountRef.current = 0 // Reset retry count on successful start
  }, [setLoading])

  const handleProgress = useCallback(
    (progress: { playedSeconds: number; played: number; loadedSeconds: number; loaded: number }) => {
      // Log first few progress updates
      if (progress.playedSeconds < 5) {
        console.log("📊 [GlobalAudioPlayer] Progress:", progress.playedSeconds.toFixed(2), "seconds")
      }

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
    console.log("🏁 [GlobalAudioPlayer] Track ended, playing next")
    setHasStarted(false)
    setInternalPlaying(false)
    nextTrack()
  }, [nextTrack])

  if (!mounted) {
    return null
  }

  if (!currentTrack?.url) {
    return null
  }

  console.log("🎵 [GlobalAudioPlayer] RENDER - isPlaying:", isPlaying, "internalPlaying:", internalPlaying, "ready:", isReady, "hasStarted:", hasStarted)

  return (
    <div
      style={{
        position: "fixed",
        top: "-9999px",
        left: "-9999px",
        width: "100%",
        maxWidth: "600px",
        height: "300px",
        zIndex: -9999,
      }}
      aria-hidden="true"
    >
      <ReactPlayer
        key={currentTrack.url}
        ref={playerRef}
        url={currentTrack.url}
        playing={internalPlaying}
        volume={1}
        width="100%"
        height="100%"
        progressInterval={500}
        onReady={handleReady}
        onStart={handleStart}
        onPlay={() => {
          console.log("▶️▶️▶️ [GlobalAudioPlayer] onPlay event fired!")
          setHasStarted(true)
        }}
        onPause={() => console.log("⏸️ [GlobalAudioPlayer] onPause event fired")}
        onBuffer={() => console.log("⏳ [GlobalAudioPlayer] Buffering...")}
        onBufferEnd={() => console.log("✅ [GlobalAudioPlayer] Buffer end")}
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
