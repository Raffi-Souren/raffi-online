"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

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
  playTrack: (track: Track) => void
  pauseTrack: () => void
  resumeTrack: () => void
  togglePlay: () => void
  stopTrack: () => void
  nextTrack: () => void
  previousTrack: () => void
  setPlaylist: (tracks: Track[]) => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [playlist, setPlaylist] = useState<Track[]>([])

  const playTrack = useCallback((track: Track) => {
    setIsPlaying(false)
    setCurrentTrack(track)
    // Increased timeout to ensure player is ready and prevent race conditions
    setTimeout(() => setIsPlaying(true), 200)
  }, [])

  const pauseTrack = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const resumeTrack = useCallback(() => {
    if (currentTrack) {
      setIsPlaying(true)
    }
  }, [currentTrack])

  const togglePlay = useCallback(() => {
    if (currentTrack) {
      setIsPlaying(prev => !prev)
    }
  }, [currentTrack])

  const stopTrack = useCallback(() => {
    setIsPlaying(false)
    setCurrentTrack(null)
  }, [])

  const nextTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return
    
    const currentIndex = playlist.findIndex(track => track.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % playlist.length
    
    playTrack(playlist[nextIndex])
  }, [currentTrack, playlist, playTrack])

  const previousTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return
    
    const currentIndex = playlist.findIndex(track => track.id === currentTrack.id)
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length
    
    playTrack(playlist[prevIndex])
  }, [currentTrack, playlist, playTrack])

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        currentTrack,
        playlist,
        playTrack,
        pauseTrack,
        resumeTrack,
        togglePlay,
        stopTrack,
        nextTrack,
        previousTrack,
        setPlaylist,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}
