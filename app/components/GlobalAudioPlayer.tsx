"use client"

import { useEffect, useState } from 'react'
import ReactPlayer from 'react-player'
import { useAudio } from '../context/AudioContext'

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack, pauseTrack } = useAudio()
  const [isReady, setIsReady] = useState(false)

  // Handle hydration mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (!currentTrack) return null

  return (
    <div className="hidden">
      <ReactPlayer
        url={currentTrack.url}
        playing={isPlaying}
        width="0"
        height="0"
        onEnded={nextTrack}
        onError={(e) => {
          console.error("Audio playback error:", e)
          // Optional: try next track on error
          // nextTrack() 
        }}
        onReady={() => setIsReady(true)}
        config={{
          soundcloud: {
            options: {
              auto_play: false,
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
            }
          }
        }}
      />
    </div>
  )
}
