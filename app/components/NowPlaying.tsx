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
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <button
          onClick={previousTrack}
          disabled={!hasPlaylist}
          className="hover:scale-110 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
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
          className="hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded-full"
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
          className="hover:scale-110 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
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

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
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
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                className="animate-pulse"
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  display: "inline-block",
                }}
              ></span>
              <span style={{ fontSize: "9px", opacity: 0.75 }}>
                Now Playing
              </span>
            </div>
            <div
              style={{ fontSize: "9px", fontFamily: "monospace", opacity: 0.9 }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>

        <button
          onClick={stopTrack}
          className="hover:scale-110 transition-transform hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
          aria-label="Stop"
          style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.7, padding: 0 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
