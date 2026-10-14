"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import { type Track, getRandomTrackIndex } from "@/data/audio-library"
import { resolveTrackEnd, type RepeatMode } from "@/lib/audio-engine"

export type { Track }
export type { RepeatMode }

/**
 * The hidden player, as seen from a tap. Safari and iOS only let audio start inside the
 * user's own gesture, so play controls call `startInGesture` synchronously instead of
 * waiting for React effects or a network round trip.
 */
export interface AudioEngine {
  /** Starts `url` now if it is already loaded in the player. Returns false otherwise. */
  startInGesture: (url: string) => boolean
  /** True when the player itself failed and a retry needs a fresh one. */
  needsRebuild: () => boolean
}

interface AudioContextType {
  isPlaying: boolean
  currentTrack: Track | null
  playlist: Track[]
  duration: number
  currentTime: number
  isLoading: boolean
  /** The stream is loaded but the browser held playback until the next tap (Safari, iOS). */
  needsTap: boolean
  error: string | null
  shuffle: boolean
  repeatMode: RepeatMode
  volume: number
  setVolume: (volume: number) => void
  seekTo: (seconds: number) => void
  seekRequest: { trackId: string; seconds: number; token: number } | null
  /**
   * Increments every time the current track should restart from 0. The player
   * engine watches this and issues an explicit seek — a state toggle alone is
   * not enough to make the SoundCloud widget rewind.
   */
  replayToken: number
  retryToken: number
  playTrack: (track: Track) => void
  pauseTrack: () => void
  resumeTrack: () => void
  togglePlay: () => void
  stopTrack: () => void
  nextTrack: () => void
  previousTrack: () => void
  /** Advance when a track finishes playing (honors repeat mode). */
  handleTrackEnd: () => void
  setPlaylist: (tracks: Track[]) => void
  setDuration: (duration: number) => void
  setCurrentTime: (time: number) => void
  setLoading: (loading: boolean) => void
  setNeedsTap: (needsTap: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  /** The player registers itself here so taps can start audio in the same gesture. */
  registerEngine: (engine: AudioEngine | null) => void
  toggleShuffle: () => void
  cycleRepeatMode: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shuffle, setShuffle] = useState(false)
  // Default "all" preserves the original wrap-around behavior.
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("all")
  const [replayToken, setReplayToken] = useState(0)
  const [retryToken, setRetryToken] = useState(0)
  const [volume, updateVolume] = useState(80)
  const [seekRequest, setSeekRequest] = useState<AudioContextType["seekRequest"]>(null)
  const engineRef = useRef<AudioEngine | null>(null)

  const registerEngine = useCallback((engine: AudioEngine | null) => {
    engineRef.current = engine
  }, [])

  // After a failure, rebuild the player only if it broke; a stream that merely stalled
  // (or was blocked until a tap) just needs this tap to start.
  const recoverFromError = useCallback(() => {
    if (!error) return
    setIsLoading(true)
    if (!engineRef.current || engineRef.current.needsRebuild()) setRetryToken((token) => token + 1)
  }, [error])

  const setVolume = useCallback((value: number) => {
    if (Number.isFinite(value)) updateVolume(Math.max(0, Math.min(100, value)))
  }, [])

  const seekTo = useCallback(
    (seconds: number) => {
      if (!currentTrack || duration <= 0 || !Number.isFinite(seconds)) return
      const position = Math.max(0, Math.min(duration, seconds))
      setCurrentTime(position)
      setSeekRequest((previous) => ({ trackId: currentTrack.id, seconds: position, token: (previous?.token ?? 0) + 1 }))
    },
    [currentTrack, duration],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev)
  }, [])

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"))
  }, [])

  const playTrack = useCallback(
    (track: Track) => {
      recoverFromError()
      setError(null)
      setNeedsTap(false)

      // If it's the same track, just resume
      if (currentTrack?.id === track.id) {
        setIsPlaying(true)
        engineRef.current?.startInGesture(track.url)
        return
      }

      // For a new track, set loading state
      setIsLoading(true)
      setCurrentTrack(track)
      setIsPlaying(true)
      setCurrentTime(0)
      setDuration(0)
      setSeekRequest(null)
      // Starts at once when the player already holds this stream (it warms the first mix).
      engineRef.current?.startInGesture(track.url)
    },
    [currentTrack, recoverFromError],
  )

  const pauseTrack = useCallback(() => {
    setIsPlaying(false)
    setNeedsTap(false)
  }, [])

  const resumeTrack = useCallback(() => {
    if (currentTrack) {
      recoverFromError()
      setError(null)
      setNeedsTap(false)
      setIsPlaying(true)
      engineRef.current?.startInGesture(currentTrack.url)
    }
  }, [currentTrack, recoverFromError])

  const togglePlay = useCallback(() => {
    // A press while the stream is still starting means "start", not "pause": when a browser
    // blocked the first attempt, this tap is the gesture it was waiting for.
    if (isPlaying && isLoading && currentTrack) {
      setNeedsTap(false)
      engineRef.current?.startInGesture(currentTrack.url)
      return
    }
    if (isPlaying) pauseTrack()
    else resumeTrack()
  }, [isPlaying, isLoading, currentTrack, pauseTrack, resumeTrack])

  const stopTrack = useCallback(() => {
    setIsPlaying(false)
    setCurrentTrack(null)
    setIsLoading(false)
    setNeedsTap(false)
    setError(null)
    setCurrentTime(0)
    setDuration(0)
    setSeekRequest(null)
  }, [])

  const requestReplay = useCallback(() => {
    setCurrentTime(0)
    setIsPlaying(true)
    setReplayToken((token) => token + 1)
  }, [])

  const nextTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return
    if (playlist.length === 1 && playlist[0].id === currentTrack.id) return requestReplay()

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)

    if (shuffle) {
      const randomIndex = getRandomTrackIndex(playlist.length, currentIndex)
      playTrack(playlist[randomIndex])
      return
    }

    const nextIndex = (currentIndex + 1) % playlist.length
    playTrack(playlist[nextIndex])
  }, [currentTrack, playlist, playTrack, shuffle, requestReplay])

  const previousTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return
    if (currentTime > 3 || (playlist.length === 1 && playlist[0].id === currentTrack.id)) return requestReplay()

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)

    if (shuffle) {
      const randomIndex = getRandomTrackIndex(playlist.length, currentIndex)
      playTrack(playlist[randomIndex])
      return
    }

    const prevIndex = currentIndex < 0 ? playlist.length - 1 : (currentIndex - 1 + playlist.length) % playlist.length
    playTrack(playlist[prevIndex])
  }, [currentTrack, playlist, playTrack, shuffle, requestReplay, currentTime])

  // Called by the player engine when a track naturally finishes.
  const handleTrackEnd = useCallback(() => {
    if (!currentTrack) return

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)
    const action = resolveTrackEnd({
      currentIndex,
      playlistLength: playlist.length,
      shuffle,
      repeatMode,
    })

    if (action.type === "stop") {
      setIsPlaying(false)
      return
    }

    if (action.type === "replay") {
      requestReplay()
      return
    }

    const nextTrackToPlay = playlist[action.index]

    // Landing back on the current track means "start it over" — playTrack would
    // see the same id and no-op, leaving playback dead.
    if (!nextTrackToPlay || nextTrackToPlay.id === currentTrack.id) {
      requestReplay()
      return
    }

    playTrack(nextTrackToPlay)
  }, [currentTrack, playlist, playTrack, shuffle, repeatMode, requestReplay])

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        currentTrack,
        playlist,
        duration,
        currentTime,
        isLoading,
        needsTap,
        error,
        shuffle,
        repeatMode,
        volume,
        setVolume,
        seekTo,
        seekRequest,
        replayToken,
        retryToken,
        playTrack,
        pauseTrack,
        resumeTrack,
        togglePlay,
        stopTrack,
        nextTrack,
        previousTrack,
        handleTrackEnd,
        setPlaylist,
        setDuration,
        setCurrentTime,
        setLoading: setIsLoading,
        setNeedsTap,
        setError,
        clearError,
        toggleShuffle,
        cycleRepeatMode,
        registerEngine,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error("useAudio must be used within an AudioProvider")
  }
  return context
}
