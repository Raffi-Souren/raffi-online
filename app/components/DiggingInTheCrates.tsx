"use client"

import { useCallback, useEffect, useRef } from "react"
import { Shuffle, CheckCircle, Pause, Play } from "lucide-react"
import { useAudio } from "../context/AudioContext"
import { SOUNDCLOUD_TRACKS, getRandomTrackIndex } from "@/data/audio-library"
import WindowShell from "../../components/ui/WindowShell"

interface DiggingInTheCratesProps {
  isOpen: boolean
  onClose?: () => void
}

export default function DiggingInTheCrates({ isOpen, onClose }: DiggingInTheCratesProps) {
  const { currentTrack, isPlaying, isLoading, error, playTrack, setPlaylist, togglePlay } = useAudio()
  // Minimize keeps this session mounted, so restoring never reseeds the music.
  const seededRef = useRef(false)

  // On open, load the crate into the global player and play a random record.
  useEffect(() => {
    if (isOpen && !seededRef.current) {
      seededRef.current = true
      setPlaylist(SOUNDCLOUD_TRACKS)
      const randomIndex = getRandomTrackIndex(SOUNDCLOUD_TRACKS.length)
      playTrack(SOUNDCLOUD_TRACKS[randomIndex])
    }
    if (!isOpen) {
      seededRef.current = false
    }
  }, [isOpen, setPlaylist, playTrack])

  const handleShuffle = useCallback(() => {
    const currentIndex = currentTrack ? SOUNDCLOUD_TRACKS.findIndex((t) => t.id === currentTrack.id) : -1
    const randomIndex = getRandomTrackIndex(SOUNDCLOUD_TRACKS.length, currentIndex)
    // Re-assert the crate as the active playlist — another surface (the iPod)
    // may have swapped it out while this window was open.
    setPlaylist(SOUNDCLOUD_TRACKS)
    playTrack(SOUNDCLOUD_TRACKS[randomIndex])
  }, [currentTrack, playTrack, setPlaylist])

  // Closing the crate keeps the music playing via the global NowPlaying bar.
  const handleClose = () => {
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <WindowShell title="Raf’s crate" onClose={handleClose} appearance="crate" maxWidth="28rem">
      <div style={{ padding: "1.25rem", backgroundColor: "white" }}>
        <div style={{ marginBottom: "1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <CheckCircle size={22} style={{ color: "#10B981", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p
              style={{
                fontWeight: "bold",
                color: "#000000",
                margin: 0,
                marginBottom: "0.25rem",
                fontSize: "0.9375rem",
              }}
            >
              A surprise from Raf’s crate
            </p>
            <p style={{ fontSize: "0.875rem", color: "#374151", margin: 0 }}>Shuffle to dig for another track.</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            width: "100%",
          }}
        >
          {currentTrack ? (
            <>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  textAlign: "center",
                }}
              >
                {currentTrack.title}
              </h2>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#666",
                  marginBottom: "0.5rem",
                }}
              >
                {currentTrack.artist}
              </p>

              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  width: "3.5rem",
                  height: "3.5rem",
                  borderRadius: "50%",
                  backgroundColor: "#ff5500",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: "0.5rem",
                }}
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#ff5500",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "#666",
                  }}
                >
                  {error
                    ? "Track unavailable. Try Shuffle or Play to retry."
                    : isLoading
                      ? "Loading your track…"
                      : isPlaying
                        ? "Playing on SoundCloud"
                        : "Paused"}
                </span>
              </div>
            </>
          ) : (
            <p
              style={{
                fontSize: "1rem",
                color: "#666",
                textAlign: "center",
              }}
            >
              Click &quot;Shuffle&quot; to discover a random track!
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            onClick={handleShuffle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            <Shuffle size={20} />
            Shuffle
          </button>
          <button
            onClick={handleClose}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </WindowShell>
  )
}
