"use client"

import { useAudio } from "../context/AudioContext"
import { Pause, Play, X, SkipBack, SkipForward } from "lucide-react"

export default function NowPlaying() {
  const { currentTrack, isPlaying, togglePlay, stopTrack, nextTrack, previousTrack, playlist, currentTime, duration } =
    useAudio()

  if (!currentTrack) return null

  const hasPlaylist = playlist.length > 0

  // Format time helper
  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  return (
    <div
      className="fixed bottom-12 right-4 z-50 bg-gradient-to-r from-[#FF5500] to-[#FF3300] text-white rounded-lg shadow-2xl p-3 max-w-[320px]"
      style={{
        position: "fixed",
        bottom: "48px",
        right: "16px",
        zIndex: 50,
        background: "linear-gradient(to right, #FF5500, #FF3300)",
        color: "white",
        borderRadius: "8px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        padding: "12px",
        maxWidth: "320px",
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

      <div className="flex items-start gap-3" style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <button
          onClick={previousTrack}
          disabled={!hasPlaylist}
          className="flex-shrink-0 hover:scale-110 transition-transform mt-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Previous track"
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: hasPlaylist ? "pointer" : "not-allowed",
            padding: 0,
            marginTop: "4px",
          }}
        >
          <SkipBack size={18} fill="currentColor" />
        </button>

        <button
          onClick={togglePlay}
          className="flex-shrink-0 hover:scale-110 transition-transform mt-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded-full"
          aria-label={isPlaying ? "Pause" : "Play"}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: 0,
            marginTop: "4px",
          }}
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
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: hasPlaylist ? "pointer" : "not-allowed",
            padding: 0,
            marginTop: "4px",
          }}
        >
          <SkipForward size={18} fill="currentColor" />
        </button>

        <div className="flex-1 min-w-0" style={{ flex: 1, minWidth: 0 }}>
          <div
            className="text-xs font-bold mb-0.5 truncate"
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              marginBottom: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentTrack.title}
          </div>
          <div
            className="text-[10px] opacity-90 truncate"
            style={{
              fontSize: "10px",
              opacity: 0.9,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentTrack.artist}
          </div>
          <div
            className="flex items-center justify-between mt-1"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}
          >
            <div className="flex items-center gap-1" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  display: "inline-block",
                }}
              ></span>
              <span className="text-[9px] opacity-75" style={{ fontSize: "9px", opacity: 0.75 }}>
                Now Playing
              </span>
            </div>
            <div
              className="text-[9px] font-mono opacity-90"
              style={{ fontSize: "9px", fontFamily: "monospace", opacity: 0.9 }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>

        <button
          onClick={stopTrack}
          className="flex-shrink-0 hover:scale-110 transition-transform opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
          aria-label="Stop"
          style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.7, padding: 0 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
