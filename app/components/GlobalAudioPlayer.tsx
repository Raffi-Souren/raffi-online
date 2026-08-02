"use client"

import { useEffect, useRef, useState } from "react"
import { useAudio } from "../context/AudioContext"

// Module-level singleton so the SoundCloud Widget API script is only ever loaded once.
let scApiPromise: Promise<void> | null = null

function loadSoundCloudApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if ((window as any).SC) return Promise.resolve()
  if (scApiPromise) return scApiPromise

  scApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://w.soundcloud.com/player/api.js"]')
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("Failed to load SoundCloud API")))
      return
    }
    const script = document.createElement("script")
    script.src = "https://w.soundcloud.com/player/api.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load SoundCloud API"))
    document.body.appendChild(script)
  })

  return scApiPromise
}

export default function GlobalAudioPlayer() {
  const { currentTrack, isPlaying, replayToken, handleTrackEnd, setCurrentTime, setDuration, setLoading, setError } =
    useAudio()

  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  // State (not just a ref) so the load/play effects re-run and reconcile once
  // the widget comes up — a track can be picked before the API finishes loading.
  const [widgetReady, setWidgetReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<any>(null)
  const loadedUrlRef = useRef<string | null>(null)

  // Keep the latest callbacks/state in refs so the widget's bound listeners
  // always use fresh values without needing to rebind.
  const isPlayingRef = useRef(isPlaying)
  const handleTrackEndRef = useRef(handleTrackEnd)
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  useEffect(() => {
    handleTrackEndRef.current = handleTrackEnd
  }, [handleTrackEnd])

  // Mount the hidden iframe once, using the first track that gets selected.
  useEffect(() => {
    if (currentTrack?.url && !playerUrl) {
      setPlayerUrl(currentTrack.url)
      loadedUrlRef.current = currentTrack.url
      setLoading(true)
    }
  }, [currentTrack?.url, playerUrl, setLoading])

  // Initialize the SoundCloud widget exactly once, after the iframe exists.
  useEffect(() => {
    if (!playerUrl || !iframeRef.current) return
    let cancelled = false
    let dispose: (() => void) | null = null

    loadSoundCloudApi()
      .then(() => {
        if (cancelled || !iframeRef.current || !(window as any).SC) return
        const SC = (window as any).SC
        const widget = SC.Widget(iframeRef.current)
        widgetRef.current = widget

        const events = SC.Widget.Events

        widget.bind(events.READY, () => {
          setWidgetReady(true)
          setLoading(false)
          widget.getDuration((d: number) => {
            if (d && d > 0) setDuration(d / 1000)
          })
          if (isPlayingRef.current) widget.play()
        })

        widget.bind(events.PLAY_PROGRESS, (data: any) => {
          if (data?.currentPosition !== undefined) {
            setCurrentTime(data.currentPosition / 1000)
          }
        })

        // Read through the ref so this binding never captures a stale callback.
        widget.bind(events.FINISH, () => {
          handleTrackEndRef.current()
        })

        widget.bind(events.ERROR, () => {
          setError("Unable to play this track. Try another one or shuffle.")
          setLoading(false)
        })

        dispose = () => {
          try {
            widget.unbind(events.READY)
            widget.unbind(events.PLAY_PROGRESS)
            widget.unbind(events.FINISH)
            widget.unbind(events.ERROR)
          } catch {
            // Widget already torn down with the iframe; nothing to release.
          }
        }
      })
      .catch(() => {
        setError("Could not load the audio player.")
        setLoading(false)
      })

    return () => {
      cancelled = true
      dispose?.()
      widgetRef.current = null
      setWidgetReady(false)
    }
  }, [playerUrl, setLoading, setDuration, setCurrentTime, setError])

  // When the track changes, stream the new one in-place via widget.load (no remount).
  // Depends on `widgetReady` so a track selected before the widget came up still
  // gets loaded instead of leaving the iframe stuck on the initial URL.
  useEffect(() => {
    const url = currentTrack?.url
    const widget = widgetRef.current
    if (!url || !widget || !widgetReady) return
    if (loadedUrlRef.current === url) return

    loadedUrlRef.current = url
    setLoading(true)
    setCurrentTime(0)
    setDuration(0)

    widget.load(url, {
      auto_play: isPlayingRef.current,
      show_artwork: false,
      callback: () => {
        // The widget may have been torn down while the load was in flight.
        if (widgetRef.current !== widget) return
        setLoading(false)
        widget.getDuration((d: number) => {
          if (d && d > 0) setDuration(d / 1000)
        })
        if (isPlayingRef.current) widget.play()
      },
    })
  }, [currentTrack?.url, widgetReady, setLoading, setCurrentTime, setDuration])

  // Reflect play/pause toggles onto the widget.
  useEffect(() => {
    if (!widgetRef.current || !widgetReady) return
    try {
      if (isPlaying) {
        widgetRef.current.play()
      } else {
        widgetRef.current.pause()
      }
    } catch {
      // Widget not ready yet; the READY/load callbacks will sync state.
    }
  }, [isPlaying, widgetReady])

  // Repeat-one (and any wrap back onto the current track) restarts playback.
  // The widget sits at the end of the track after FINISH, so `play()` alone is
  // not reliable — it needs an explicit rewind first.
  useEffect(() => {
    if (replayToken === 0) return
    if (!widgetRef.current || !widgetReady) return
    try {
      widgetRef.current.seekTo(0)
      widgetRef.current.play()
      setCurrentTime(0)
    } catch {
      // Widget went away mid-replay; the next track change will resync.
    }
  }, [replayToken, widgetReady, setCurrentTime])

  if (!playerUrl) return null

  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    playerUrl,
  )}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false&show_artwork=false`

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
        title="Audio stream"
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
