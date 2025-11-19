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
      const isAbortError = event.reason?.name === 'AbortError'
      const isPlayInterrupted = 
        event.reason?.message?.includes('interrupted') || 
        event.reason?.message?.includes('play()') ||
        event.reason?.message?.includes('pause()')
      
      if (isAbortError || isPlayInterrupted) {
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

    // Increased debounce time to 150ms to better handle slow network/loading states
    playingTimeoutRef.current = setTimeout(() => {
      setInternalPlaying(isPlaying)
    }, 150)

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
        onError={(e) => {
          // Suppress harmless play/pause interruption errors
          console.log('[v0] Suppressed player error:', e)
        }}
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
