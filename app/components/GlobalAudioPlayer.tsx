"use client"

import { useEffect, useState, useRef } from "react"
import { useAudio } from "../context/AudioContext"

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, nextTrack, setCurrentTime, setDuration, setLoading, setError } = useAudio()
  const [mounted, setMounted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !currentTrack?.url) return

    // Load SoundCloud Widget API
    const script = document.createElement("script")
    script.src = "https://w.soundcloud.com/player/api.js"
    script.async = true
    script.onload = () => {
      if (iframeRef.current && (window as any).SC) {
        const widget = (window as any).SC.Widget(iframeRef.current)
        widgetRef.current = widget

        widget.bind((window as any).SC.Widget.Events.READY, () => {
          setLoading(false)

          // Get duration
          widget.getDuration((duration: number) => {
            if (duration && duration > 0) {
              setDuration(duration / 1000) // Convert ms to seconds
            }
          })

          // Control playback based on isPlaying state
          if (isPlaying) {
            widget.play()
          } else {
            widget.pause()
          }
        })

        widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
          if (data.currentPosition !== undefined) {
            setCurrentTime(data.currentPosition / 1000) // Convert ms to seconds
          }
        })

        widget.bind((window as any).SC.Widget.Events.FINISH, () => {
          nextTrack()
        })

        widget.bind((window as any).SC.Widget.Events.ERROR, () => {
          setError("Unable to play this track. Try shuffling for another track.")
          setLoading(false)
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      if (widgetRef.current) {
        widgetRef.current.unbind((window as any).SC.Widget.Events.READY)
        widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY_PROGRESS)
        widgetRef.current.unbind((window as any).SC.Widget.Events.FINISH)
        widgetRef.current.unbind((window as any).SC.Widget.Events.ERROR)
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [mounted, currentTrack?.url])

  useEffect(() => {
    if (widgetRef.current) {
      if (isPlaying) {
        widgetRef.current.play()
      } else {
        widgetRef.current.pause()
      }
    }
  }, [isPlaying])

  if (!mounted || !currentTrack?.url) {
    return null
  }

  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(currentTrack.url)}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false&show_artwork=false`

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: "0",
        right: "0",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0.01,
        zIndex: -1,
      }}
    >
      <iframe
        ref={iframeRef}
        key={currentTrack.url}
        src={embedUrl}
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
      />
    </div>
  )
}
