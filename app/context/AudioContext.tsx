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
  playTrack: (track: Track) => void
  pauseTrack: () => void
  resumeTrack: () => void
  togglePlay: () => void
  stopTrack: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)

  const playTrack = useCallback((track: Track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
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

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        currentTrack,
        playTrack,
        pauseTrack,
        resumeTrack,
        togglePlay,
        stopTrack,
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
