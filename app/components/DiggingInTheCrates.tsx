"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Shuffle, X, CheckCircle } from "lucide-react"
import { type Track, SOUNDCLOUD_TRACKS } from "@/data/crates-tracks"

const scEmbed = (url: string) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    url,
  )}&auto_play=false&show_teaser=true&show_user=true&visual=false`

interface DiggingInTheCratesProps {
  isOpen: boolean
  onClose?: () => void
}

export default function DiggingInTheCrates({ isOpen, onClose }: DiggingInTheCratesProps) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen && !currentTrack) {
      const randomIndex = Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)
      setCurrentTrack(SOUNDCLOUD_TRACKS[randomIndex])
    }
  }, [isOpen, currentTrack])

  // Focus management
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement
      dialogRef.current?.focus()
    } else {
      prevFocusRef.current?.focus?.()
    }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  const handleShuffle = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * SOUNDCLOUD_TRACKS.length)
    setCurrentTrack(SOUNDCLOUD_TRACKS[randomIndex])
  }, [])

  const handleClose = () => {
    setCurrentTrack(null)
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 101,
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
          aria-modal="true"
          aria-labelledby="secret-title"
          tabIndex={-1}
          style={{
            width: "100%",
            maxWidth: "28rem",
            maxHeight: "90vh",
            overflow: "auto",
            borderRadius: "0.5rem",
            border: "4px solid #FBBF24",
            backgroundColor: "white",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            pointerEvents: "auto",
            color: "#111827",
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(to right, #FBBF24, #F59E0B)",
              padding: "0.75rem 1rem",
              borderTopLeftRadius: "0.375rem",
              borderTopRightRadius: "0.375rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.125rem" }}>🔔</span>
              <h2 id="secret-title" style={{ fontWeight: "bold", color: "#000000", margin: 0, fontSize: "1rem" }}>
                SECRET FOUND!
              </h2>
            </div>
            <button
              aria-label="Close"
              onClick={handleClose}
              style={{
                borderRadius: "0.25rem",
                padding: "0.5rem",
                color: "#000000",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.2s",
                minWidth: "44px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F59E0B")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <X size={18} />
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
                  Congratulations!
                </p>
                <p style={{ fontSize: "0.875rem", color: "#374151", margin: 0 }}>
                  You&apos;ve found a record from RAF&apos;s crate!
                </p>
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
                      marginBottom: "1rem",
                    }}
                  >
                    {currentTrack.artist}
                  </p>

                  <div
                    style={{
                      width: "100%",
                      marginBottom: "1rem",
                    }}
                  >
                    <iframe
                      src={scEmbed(currentTrack.url)}
                      width="100%"
                      height="166"
                      allow="autoplay"
                      style={{ border: "none" }}
                    />
                  </div>

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
                      SoundCloud
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
                  Click "Shuffle" to discover a random track!
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
