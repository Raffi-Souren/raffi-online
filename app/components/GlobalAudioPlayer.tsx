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

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
      } else {
        const errorMessage =
          "Unable to play this track. It may be unavailable, private, or region-restricted. Try shuffling for another track."
        setError(errorMessage)
        setLoading(false)
      }
    },
    [setError, setLoading],
  )

  const handleReady = useCallback(() => {
    setLoading(false)

    if (playerRef.current) {
      try {
        const d = playerRef.current.getDuration?.()
        if (d && d !== Number.POSITIVE_INFINITY && !isNaN(d) && d > 0) {
          setDuration(d)
        }
      } catch (e) {
        // Silently fail
      }
    }
  }, [setDuration, setLoading])

  const handleStart = useCallback(() => {
    setLoading(false)
    retryCountRef.current = 0
  }, [setLoading])

  const handleProgress = useCallback(
    (progress: { playedSeconds: number }) => {
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
          // Silently fail
        }
      }
    },
    [setCurrentTime, setDuration],
  )

  const handleEnded = useCallback(() => {
    nextTrack()
  }, [nextTrack])

  if (!mounted || !currentTrack?.url) {
    return null
  }

  // The iframe needs to be "visible enough" to the browser (opacity: 0.01, not 0)
  // with no overflow:hidden that could block event propagation
  return (
    <div
      className="sc-player-wrapper"
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "1px",
        height: "1px",
        opacity: 0.01,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <ReactPlayer
        key={currentTrack.url}
        ref={playerRef}
        url={currentTrack.url}
        playing={isPlaying}
        volume={1}
        width="300px"
        height="150px"
        progressInterval={500}
        onReady={handleReady}
        onStart={handleStart}
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
