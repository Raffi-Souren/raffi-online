"use client"

import { useCallback, useEffect, useRef } from "react"
import { Shuffle, X, CheckCircle, Pause, Play } from "lucide-react"
import { useAudio } from "../context/AudioContext"
import { SOUNDCLOUD_TRACKS, getRandomTrackIndex } from "@/data/audio-library"
import { useWindowActivity } from "../../components/ui/WindowShell"

interface DiggingInTheCratesProps {
  isOpen: boolean
  onClose?: () => void
}

export default function DiggingInTheCrates({ isOpen, onClose }: DiggingInTheCratesProps) {
  const { currentTrack, isPlaying, isLoading, error, playTrack, setPlaylist, togglePlay } = useAudio()
  const { active, layer, onActivate } = useWindowActivity()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Tracks whether we've already seeded a pick for this open session.
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

  // Focus management
  useEffect(() => {
    if (isOpen && active) {
      dialogRef.current?.focus()
    }
  }, [active, isOpen])

  // Close on ESC
  useEffect(() => {
    if (!isOpen || !active) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, isOpen, onClose])

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
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: layer,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: layer + 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.5rem",
          pointerEvents: "none",
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal={active ? "true" : undefined}
          aria-hidden={active ? undefined : "true"}
          aria-labelledby="secret-title"
          tabIndex={-1}
          onPointerDownCapture={onActivate}
          style={{
            width: "100%",
            maxWidth: "28rem",
            maxHeight: "90vh",
            overflow: "auto",
            borderRadius: "10px",
            border: "1px solid #c59621",
            backgroundColor: "white",
            boxShadow: "0 24px 72px rgba(12, 32, 64, 0.38)",
            pointerEvents: "auto",
            color: "#111827",
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background: "linear-gradient(to right, #FBBF24, #F59E0B)",
              padding: "4px 12px",
              minHeight: "52px",
              borderBottom: "1px solid #c59621",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28)",
              borderTopLeftRadius: "9px",
              borderTopRightRadius: "9px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0 44px",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "1.125rem" }}>🔔</span>
              <h2 id="secret-title" style={{ fontWeight: "bold", color: "#000000", margin: 0, fontSize: "1rem" }}>
                Raf’s crate
              </h2>
            </div>
            <button
              aria-label="Close"
              onClick={handleClose}
              className="group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#795800]"
              style={{
                position: "absolute",
                left: "6px",
                borderRadius: "5px",
                padding: 0,
                color: "#000000",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                minWidth: "44px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#ff6058",
                  border: "1px solid rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X
                  size={10}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="opacity-0 group-hover:opacity-80 group-focus-visible:opacity-80"
                />
              </span>
            </button>
          </div>

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
        </div>
      </div>
    </>
  )
}
