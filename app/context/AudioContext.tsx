"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { type Track, getRandomTrackIndex } from "@/data/audio-library"

export type { Track }

export type RepeatMode = "off" | "one" | "all"

interface AudioContextType {
  isPlaying: boolean
  currentTrack: Track | null
  playlist: Track[]
  duration: number
  currentTime: number
  isLoading: boolean
  error: string | null
  shuffle: boolean
  repeatMode: RepeatMode
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
  setError: (error: string | null) => void
  clearError: () => void
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
  const [error, setError] = useState<string | null>(null)
  const [shuffle, setShuffle] = useState(false)
  // Default "all" preserves the original wrap-around behavior.
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("all")

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
      // Clear any previous errors
      setError(null)

      // If it's the same track, just resume
      if (currentTrack?.id === track.id) {
        setIsPlaying(true)
        return
      }

      // For a new track, set loading state
      setIsLoading(true)
      setCurrentTrack(track)
      setIsPlaying(true)
      setCurrentTime(0)
      setDuration(0)
    },
    [currentTrack],
  )

  const pauseTrack = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const resumeTrack = useCallback(() => {
    if (currentTrack) {
      setError(null)
      setIsPlaying(true)
    }
  }, [currentTrack])

  const togglePlay = useCallback(() => {
    if (currentTrack) {
      setIsPlaying((prev) => !prev)
    }
  }, [currentTrack])

  const stopTrack = useCallback(() => {
    setIsPlaying(false)
    setCurrentTrack(null)
    setIsLoading(false)
    setError(null)
  }, [])

  const nextTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)

    if (shuffle) {
      const randomIndex = getRandomTrackIndex(playlist.length, currentIndex)
      playTrack(playlist[randomIndex])
      return
    }

    const nextIndex = (currentIndex + 1) % playlist.length
    playTrack(playlist[nextIndex])
  }, [currentTrack, playlist, playTrack, shuffle])

  const previousTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)

    if (shuffle) {
      const randomIndex = getRandomTrackIndex(playlist.length, currentIndex)
      playTrack(playlist[randomIndex])
      return
    }

    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length
    playTrack(playlist[prevIndex])
  }, [currentTrack, playlist, playTrack, shuffle])

  // Called by the player engine when a track naturally finishes.
  const handleTrackEnd = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return

    // Repeat one: replay the same track from the start.
    if (repeatMode === "one") {
      setCurrentTime(0)
      setIsPlaying(false)
      // Re-trigger play on the next tick so the widget seeks to 0 and replays.
      setTimeout(() => setIsPlaying(true), 0)
      return
    }

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)

    if (shuffle) {
      const randomIndex = getRandomTrackIndex(playlist.length, currentIndex)
      playTrack(playlist[randomIndex])
      return
    }

    const isLastTrack = currentIndex === playlist.length - 1

    // Repeat off: stop at the end of the playlist.
    if (repeatMode === "off" && isLastTrack) {
      setIsPlaying(false)
      return
    }

    const nextIndex = (currentIndex + 1) % playlist.length
    playTrack(playlist[nextIndex])
  }, [currentTrack, playlist, playTrack, shuffle, repeatMode])

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        currentTrack,
        playlist,
        duration,
        currentTime,
        isLoading,
        error,
        shuffle,
        repeatMode,
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
        setError,
        clearError,
        toggleShuffle,
        cycleRepeatMode,
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
