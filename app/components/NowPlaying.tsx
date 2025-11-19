"use client"

import { useAudio } from '../context/AudioContext'
import { Pause, Play, X } from 'lucide-react'

export default function NowPlaying() {
  const { currentTrack, isPlaying, togglePlay, stopTrack } = useAudio()

  if (!currentTrack) return null

  return (
    <div 
      className="fixed bottom-12 right-4 z-40 bg-gradient-to-r from-[#FF5500] to-[#FF3300] text-white rounded-lg shadow-2xl p-3 max-w-[280px] animate-slide-in"
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      
      <div className="flex items-start gap-3">
        <button 
          onClick={togglePlay}
          className="flex-shrink-0 hover:scale-110 transition-transform mt-1"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold mb-0.5 truncate">
            {currentTrack.title}
          </div>
          <div className="text-[10px] opacity-90 truncate">
            {currentTrack.artist}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span className="text-[9px] opacity-75">Now Playing</span>
          </div>
        </div>
        
        <button
          onClick={stopTrack}
          className="flex-shrink-0 hover:scale-110 transition-transform opacity-70 hover:opacity-100"
          aria-label="Stop"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
