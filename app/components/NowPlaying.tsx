"use client"

import { useAudio } from "../context/AudioContext"
import { Pause, Play, X, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from "lucide-react"

export default function NowPlaying() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    stopTrack,
    nextTrack,
    previousTrack,
    playlist,
    currentTime,
    duration,
    isLoading,
    error,
    shuffle,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = useAudio()

  if (!currentTrack) return null

  const hasPlaylist = playlist.length > 0

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  const controlStyle = {
    background: "none",
    border: "none",
    color: "white",
    cursor: "pointer",
    padding: 0,
    width: "44px",
    height: "44px",
    minWidth: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
  } as const

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(48px + env(safe-area-inset-bottom, 0px))",
        right: "max(8px, env(safe-area-inset-right, 0px))",
        zIndex: 50,
        background: "linear-gradient(to right, #FF5500, #FF3300)",
        color: "white",
        borderRadius: "8px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        boxSizing: "border-box",
        padding: "8px 10px",
        width:
          "min(420px, calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))",
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div
          className="order-2 flex w-full items-center justify-between sm:order-1 sm:w-auto sm:flex-shrink-0"
          aria-label="Playback controls"
        >
          <button
            type="button"
            onClick={toggleShuffle}
            className="hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
            aria-label={shuffle ? "Shuffle on" : "Shuffle off"}
            aria-pressed={shuffle}
            title={shuffle ? "Shuffle: On" : "Shuffle: Off"}
            style={{ ...controlStyle, opacity: shuffle ? 1 : 0.45 }}
          >
            <Shuffle size={18} />
          </button>

          <button
            type="button"
            onClick={previousTrack}
            disabled={!hasPlaylist}
            className="hover:scale-110 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
            aria-label="Previous track"
            style={{ ...controlStyle, cursor: hasPlaylist ? "pointer" : "not-allowed" }}
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded-full"
            aria-label={isPlaying ? "Pause" : "Play"}
            style={controlStyle}
          >
            {isPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={nextTrack}
            disabled={!hasPlaylist}
            className="hover:scale-110 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
            aria-label="Next track"
            style={{ ...controlStyle, cursor: hasPlaylist ? "pointer" : "not-allowed" }}
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={cycleRepeatMode}
            className="hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
            aria-label={`Repeat: ${repeatMode}`}
            title={
              repeatMode === "off" ? "Repeat: Off" : repeatMode === "all" ? "Repeat: All" : "Repeat: One"
            }
            style={{ ...controlStyle, opacity: repeatMode === "off" ? 0.45 : 1 }}
          >
            {repeatMode === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>

        <div className="order-1 flex min-w-0 items-center gap-2 sm:order-2 sm:flex-1">
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
                  className={isPlaying && !isLoading && !error ? "motion-safe:animate-pulse" : undefined}
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "white",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: "9px", opacity: 0.9 }}>
                  {error ? "Stream unavailable" : isLoading ? "Loading stream" : isPlaying ? "Now playing" : "Paused"}
                </span>
              </div>
              <div style={{ fontSize: "9px", fontFamily: "monospace", opacity: 0.9 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={stopTrack}
            className="hover:scale-110 transition-transform hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FF5500] rounded"
            aria-label="Stop playback"
            style={{ ...controlStyle, opacity: 0.7 }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
