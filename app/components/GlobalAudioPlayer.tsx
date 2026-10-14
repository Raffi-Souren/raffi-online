"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BADCOMPANY_MIXES } from "@/data/audio-library"
import { useAudio } from "../context/AudioContext"

// "Play a mix" on the welcome card starts this stream, so it is the one worth warming up.
const WARM_URL = BADCOMPANY_MIXES[0]?.url

interface SoundCloudProgress {
  currentPosition?: number
}

interface SoundCloudWidget {
  bind: (event: string, listener: (data: SoundCloudProgress) => void) => void
  unbind: (event: string) => void
  play: () => void
  pause: () => void
  seekTo: (milliseconds: number) => void
  setVolume: (volume: number) => void
  getDuration: (callback: (milliseconds: number) => void) => void
  load: (url: string, options: { auto_play: boolean; show_artwork: boolean; callback: () => void }) => void
}

interface SoundCloudApi {
  Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidget) & {
    Events: Record<"READY" | "PLAY_PROGRESS" | "PLAY" | "FINISH" | "ERROR", string>
  }
}

function soundCloudApi() {
  return (window as Window & { SC?: SoundCloudApi }).SC
}

let scApiPromise: Promise<void> | null = null

function loadSoundCloudApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (soundCloudApi()) return Promise.resolve()
  if (scApiPromise) return scApiPromise

  scApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://w.soundcloud.com/player/api.js"]')
    const script = existing ?? document.createElement("script")
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.removeEventListener("load", loaded)
      script.removeEventListener("error", failed)
    }
    const failed = () => {
      cleanup()
      script.remove()
      reject(new Error("Failed to load SoundCloud API"))
    }
    const loaded = () => {
      if (!soundCloudApi()) return failed()
      cleanup()
      resolve()
    }
    const timeout = window.setTimeout(failed, 15000)
    script.addEventListener("load", loaded)
    script.addEventListener("error", failed)
    if (!existing) {
      script.src = "https://w.soundcloud.com/player/api.js"
      script.async = true
      document.body.appendChild(script)
    }
  }).catch((error: unknown) => {
    scApiPromise = null
    throw error
  })

  return scApiPromise
}

export default function GlobalAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    volume,
    seekRequest,
    replayToken,
    retryToken,
    handleTrackEnd,
    pauseTrack,
    setCurrentTime,
    setDuration,
    setLoading,
    setError,
    registerEngine,
    needsTap,
    setNeedsTap,
  } = useAudio()

  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  // State (not just a ref) so the load/play effects re-run and reconcile once
  // the widget comes up — a track can be picked before the API finishes loading.
  const [widgetReady, setWidgetReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<SoundCloudWidget | null>(null)
  const loadedUrlRef = useRef<string | null>(null)
  const readyUrlRef = useRef<string | null>(null)
  // The player itself failed (script or widget error), so a retry needs a fresh iframe.
  const brokenRef = useRef(false)
  // Set when play() had to run outside a tap; if nothing plays soon, ask for one.
  const nudgeRef = useRef<number | null>(null)

  // Keep the latest callbacks/state in refs so the widget's bound listeners
  // always use fresh values without needing to rebind.
  const isPlayingRef = useRef(isPlaying)
  const handleTrackEndRef = useRef(handleTrackEnd)
  const volumeRef = useRef(volume)
  const currentUrlRef = useRef(currentTrack?.url)
  useEffect(() => {
    volumeRef.current = volume
  }, [volume])
  useEffect(() => {
    currentUrlRef.current = currentTrack?.url
  }, [currentTrack?.url])
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  useEffect(() => {
    handleTrackEndRef.current = handleTrackEnd
  }, [handleTrackEnd])

  // play() outside a tap starts on Chrome, but Safari and iOS hold it. If the stream has
  // not started shortly after, say so, rather than leaving "Tuning in…" up.
  const clearNudge = useCallback(() => {
    if (nudgeRef.current !== null) window.clearTimeout(nudgeRef.current)
    nudgeRef.current = null
  }, [])
  const playOutsideTap = useCallback(
    (widget: SoundCloudWidget, url: string) => {
      widget.play()
      clearNudge()
      nudgeRef.current = window.setTimeout(() => {
        nudgeRef.current = null
        if (currentUrlRef.current === url && isPlayingRef.current) setNeedsTap(true)
      }, 3000)
    },
    [clearNudge, setNeedsTap],
  )
  useEffect(() => clearNudge, [clearNudge])

  // Taps call this synchronously. Safari and iOS only start audio inside the user's own
  // gesture, so waiting for an effect or a network round trip would need a second tap.
  useEffect(() => {
    registerEngine({
      startInGesture: (url) => {
        const widget = widgetRef.current
        if (!widget || readyUrlRef.current !== url) return false
        try {
          clearNudge()
          widget.play()
          return true
        } catch {
          return false
        }
      },
      needsRebuild: () => brokenRef.current,
    })
    return () => registerEngine(null)
  }, [registerEngine, clearNudge])

  // Warm the player once the page settles, so the first "Play a mix" starts inside its tap.
  // Visitors who asked to save data only load it when they press play.
  useEffect(() => {
    if (playerUrl || !WARM_URL) return
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (connection?.saveData || /2g$/.test(connection?.effectiveType ?? "")) return
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    let idle: number | null = null
    const warm = () => {
      if (loadedUrlRef.current) return
      loadedUrlRef.current = WARM_URL
      setPlayerUrl(WARM_URL)
    }
    const timer = window.setTimeout(() => {
      if (idleWindow.requestIdleCallback) idle = idleWindow.requestIdleCallback(warm, { timeout: 3000 })
      else warm()
    }, 1500)
    return () => {
      window.clearTimeout(timer)
      if (idle !== null) idleWindow.cancelIdleCallback?.(idle)
    }
  }, [playerUrl])

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
        const SC = soundCloudApi()
        if (cancelled || !iframeRef.current || !SC) return
        const widget = SC.Widget(iframeRef.current)
        widgetRef.current = widget
        // Rebinding after a network error reloads the selected stream in place.
        if (retryToken > 0) loadedUrlRef.current = null

        const events = SC.Widget.Events

        widget.bind(events.READY, () => {
          brokenRef.current = false
          setWidgetReady(true)
          // A different stream was requested while the iframe booted; the load effect takes it.
          if (loadedUrlRef.current !== playerUrl) return
          const readyUrl = playerUrl
          readyUrlRef.current = readyUrl
          widget.setVolume(volumeRef.current)
          // Warmed before anyone pressed play: stay quiet until a track is chosen.
          if (currentUrlRef.current !== readyUrl) return
          widget.getDuration((d: number) => {
            if (widgetRef.current === widget && currentUrlRef.current === readyUrl && d && d > 0) {
              setDuration(d / 1000)
            }
          })
          if (isPlayingRef.current) playOutsideTap(widget, readyUrl)
          else setLoading(false)
        })

        widget.bind(events.PLAY, () => {
          if (!isPlayingRef.current) return widget.pause()
          if (!readyUrlRef.current || readyUrlRef.current !== currentUrlRef.current) return
          clearNudge()
          setNeedsTap(false)
          setLoading(false)
          setError(null)
        })

        widget.bind(events.PLAY_PROGRESS, (data) => {
          if (
            readyUrlRef.current &&
            readyUrlRef.current === currentUrlRef.current &&
            data?.currentPosition !== undefined
          ) {
            setCurrentTime(data.currentPosition / 1000)
            if (isPlayingRef.current) setLoading(false)
          }
        })

        // Read through the ref so this binding never captures a stale callback.
        widget.bind(events.FINISH, () => {
          if (readyUrlRef.current && readyUrlRef.current === currentUrlRef.current) handleTrackEndRef.current()
        })

        widget.bind(events.ERROR, () => {
          brokenRef.current = true
          setError("Unable to play this track. Try another one or shuffle.")
          setLoading(false)
          pauseTrack()
        })

        dispose = () => {
          try {
            widget.unbind(events.READY)
            widget.unbind(events.PLAY_PROGRESS)
            widget.unbind(events.PLAY)
            widget.unbind(events.FINISH)
            widget.unbind(events.ERROR)
          } catch {
            // Widget already torn down with the iframe; nothing to release.
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        brokenRef.current = true
        setError("Could not load the audio player.")
        setLoading(false)
        pauseTrack()
      })

    return () => {
      cancelled = true
      dispose?.()
      widgetRef.current = null
      readyUrlRef.current = null
      setWidgetReady(false)
    }
  }, [playerUrl, retryToken, setLoading, setDuration, setCurrentTime, setError, pauseTrack, playOutsideTap, clearNudge, setNeedsTap])

  useEffect(() => {
    // A stream waiting for a tap is fine as it is; the timeout is for streams that never load.
    if (!isLoading || needsTap) return
    const timeout = window.setTimeout(() => {
      pauseTrack()
      setLoading(false)
      setError("This stream did not start. Press play to retry or choose another track.")
    }, 20000)
    return () => window.clearTimeout(timeout)
  }, [isLoading, needsTap, currentTrack?.id, retryToken, pauseTrack, setLoading, setError])

  // When the track changes, stream the new one in-place via widget.load (no remount).
  // Depends on `widgetReady` so a track selected before the widget came up still
  // gets loaded instead of leaving the iframe stuck on the initial URL.
  useEffect(() => {
    const url = currentTrack?.url
    const widget = widgetRef.current
    if (!url) {
      // Stopped: keep the stream loaded (it stays warm) but rewind it for next time.
      if (widget && widgetReady) {
        try {
          widget.pause()
          widget.seekTo(0)
        } catch {
          // The widget went away; the next selection reloads it.
        }
      }
      return
    }
    if (!widget || !widgetReady) return
    if (loadedUrlRef.current === url) {
      // Already in the player (warmed, or the iframe's first stream): nothing to load,
      // but the duration was never read for this selection.
      if (readyUrlRef.current === url) {
        widget.setVolume(volumeRef.current)
        widget.getDuration((d: number) => {
          if (widgetRef.current === widget && currentUrlRef.current === url && d && d > 0) setDuration(d / 1000)
        })
      }
      return
    }

    loadedUrlRef.current = url
    readyUrlRef.current = null
    setLoading(true)
    setCurrentTime(0)
    setDuration(0)

    widget.load(url, {
      auto_play: isPlayingRef.current,
      show_artwork: false,
      callback: () => {
        // The widget may have been torn down while the load was in flight.
        if (widgetRef.current !== widget || currentUrlRef.current !== url) return
        readyUrlRef.current = url
        widget.setVolume(volumeRef.current)
        widget.getDuration((d: number) => {
          if (currentUrlRef.current === url && d && d > 0) setDuration(d / 1000)
        })
        if (isPlayingRef.current) playOutsideTap(widget, url)
        else setLoading(false)
      },
    })
  }, [currentTrack?.url, widgetReady, setLoading, setCurrentTime, setDuration, playOutsideTap])

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

  useEffect(() => {
    if (widgetReady) widgetRef.current?.setVolume(volume)
  }, [volume, widgetReady])

  useEffect(() => {
    if (widgetReady && seekRequest?.trackId === currentTrack?.id && seekRequest) {
      widgetRef.current?.seekTo(seekRequest.seconds * 1000)
    }
  }, [seekRequest, widgetReady, currentTrack?.id])

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
        key={retryToken}
        ref={iframeRef}
        title="Audio stream"
        src={embedUrl}
        width="320"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        tabIndex={-1}
      />
    </div>
  )
}
