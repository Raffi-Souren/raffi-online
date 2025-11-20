"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface Track {
  id: string
  title: string
  artist: string
  url: string
}

interface AudioContextType {
  isPlaying: boolean
  currentTrack: Track | null
  playlist: Track[]
  duration: number
  currentTime: number
  isLoading: boolean
  error: string | null
  playTrack: (track: Track) => void
  pauseTrack: () => void
  resumeTrack: () => void
  togglePlay: () => void
  stopTrack: () => void
  nextTrack: () => void
  previousTrack: () => void
  setPlaylist: (tracks: Track[]) => void
  setDuration: (duration: number) => void
  setCurrentTime: (time: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const playTrack = useCallback(
    (track: Track) => {
      console.log("[AudioContext] playTrack called:", track.title, track.url)

      // Clear any previous errors
      setError(null)

      // If it's the same track, just resume
      if (currentTrack?.id === track.id) {
        console.log("[AudioContext] Same track, resuming")
        setIsPlaying(true)
        return
      }

      // For a new track, set loading state
      console.log("[AudioContext] New track, setting loading state")
      setIsLoading(true)
      setCurrentTrack(track)
      setIsPlaying(true)
      setCurrentTime(0)
      setDuration(0)
    },
    [currentTrack],
  )

  const pauseTrack = useCallback(() => {
    console.log("[AudioContext] pauseTrack called")
    setIsPlaying(false)
  }, [])

  const resumeTrack = useCallback(() => {
    console.log("[AudioContext] resumeTrack called")
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
    console.log("[AudioContext] stopTrack called")
    setIsPlaying(false)
    setCurrentTrack(null)
    setIsLoading(false)
    setError(null)
  }, [])

  const nextTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % playlist.length

    playTrack(playlist[nextIndex])
  }, [currentTrack, playlist, playTrack])

  const previousTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length

    playTrack(playlist[prevIndex])
  }, [currentTrack, playlist, playTrack])

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
        playTrack,
        pauseTrack,
        resumeTrack,
        togglePlay,
        stopTrack,
        nextTrack,
        previousTrack,
        setPlaylist,
        setDuration,
        setCurrentTime,
        setLoading: setIsLoading,
        setError,
        clearError,
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
