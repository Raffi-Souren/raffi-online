"use client"

import { useAudio } from '../context/AudioContext'
import { Pause, Play, X, SkipBack, SkipForward } from 'lucide-react'

export default function NowPlaying() {
  const { currentTrack, isPlaying, togglePlay, stopTrack, nextTrack, previousTrack, playlist } = useAudio()

  if (!currentTrack) return null

  const hasPlaylist = playlist.length > 0

  return (
    <div 
      className="fixed bottom-12 right-4 z-[60] bg-gradient-to-r from-[#FF5500] to-[#FF3300] text-white rounded-lg shadow-2xl p-3 max-w-[320px] animate-slide-in"
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
          onClick={previousTrack}
          disabled={!hasPlaylist}
          className="flex-shrink-0 hover:scale-110 transition-transform mt-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Previous track"
        >
          <SkipBack size={18} fill="currentColor" />
        </button>

        <button 
          onClick={togglePlay}
          className="flex-shrink-0 hover:scale-110 transition-transform mt-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded-full"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        <button 
          onClick={nextTrack}
          disabled={!hasPlaylist}
          className="flex-shrink-0 hover:scale-110 transition-transform mt-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Next track"
        >
          <SkipForward size={18} fill="currentColor" />
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
          className="flex-shrink-0 hover:scale-110 transition-transform opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
          aria-label="Stop"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
