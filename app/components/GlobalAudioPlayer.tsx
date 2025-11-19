"use client"

import React, { useRef, useEffect, useState } from 'react'
import ReactPlayer from 'react-player'
import { useAudio } from '../context/AudioContext'

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, stopTrack } = useAudio()
  const playerRef = useRef<ReactPlayer>(null)
  const [internalPlaying, setInternalPlaying] = useState(false)
  const playingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'AbortError' && event.reason?.message?.includes('play()')) {
        // Suppress AbortError from audio play/pause race conditions
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  useEffect(() => {
    // Clear any pending timeout
    if (playingTimeoutRef.current) {
      clearTimeout(playingTimeoutRef.current)
    }

    // Delay state change to allow previous play/pause to complete
    playingTimeoutRef.current = setTimeout(() => {
      setInternalPlaying(isPlaying)
    }, 100)

    return () => {
      if (playingTimeoutRef.current) {
        clearTimeout(playingTimeoutRef.current)
      }
    }
  }, [isPlaying])

  if (!currentTrack) return null

  return (
    <div className="hidden">
      <ReactPlayer
        ref={playerRef}
        key={currentTrack.id}
        url={currentTrack.url}
        playing={internalPlaying}
        width="0"
        height="0"
        onEnded={stopTrack}
        config={{
          soundcloud: {
            options: {
              auto_play: false,
              visual: false,
              show_artwork: false
            }
          }
        }}
      />
    </div>
  )
}
