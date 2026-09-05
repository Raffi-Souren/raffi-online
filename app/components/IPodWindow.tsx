"use client"

import WindowShell from "../../components/ui/WindowShell"
import IPodPlayer from "./IPodPlayer"
import Image from "next/image"
import { Play } from "lucide-react"
import { useAudio } from "../context/AudioContext"
import { BADCOMPANY_MIXES, FEATURED_BADCOMPANY_MIX, FEATURED_RAFS_CRATE, type Track } from "@/data/audio-library"

interface IPodWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function IPodWindow({ isOpen, onClose }: IPodWindowProps) {
  const { setPlaylist, playTrack, currentTrack, isPlaying, isLoading, error } = useAudio()
  const listen = (tracks: Track[]) => {
    setPlaylist(tracks)
    playTrack(tracks[0])
  }
  if (!isOpen) return null

  return (
    <WindowShell title="iPod" onClose={onClose} maxWidth="920px">
      <section
        aria-label="Featured listening"
        style={{ background: "#e9e4d4", padding: "14px 18px", borderBottom: "1px solid #b3ac96", color: "#273b38" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Image
            src={FEATURED_BADCOMPANY_MIX.artwork}
            alt="Andromeda mix artwork from BADCOMPANY on SoundCloud"
            width={64}
            height={64}
            unoptimized
            style={{ border: "1px solid #a8a18d", flexShrink: 0 }}
          />
          <div style={{ flex: "1 1 180px" }}>
            <strong style={{ fontSize: 16 }}>Andromeda by sweeterman</strong>
            <p style={{ fontSize: 12, marginTop: 4 }}>
              A set from the BADCOMPANY archive, alongside RAF’s 50-track crate.
            </p>
          </div>
          {[
            { label: "Play RAF’s Crate", tracks: FEATURED_RAFS_CRATE },
            {
              label: "Play Andromeda · sweeterman",
              tracks: [FEATURED_BADCOMPANY_MIX.track, ...BADCOMPANY_MIXES.filter((track) => track.id !== "bc-3")],
            },
          ].map((entry) => (
            <button
              key={entry.label}
              onClick={() => listen(entry.tracks)}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 44,
                border: "1px solid #7d8980",
                background: "#f9f5e7",
                padding: "8px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <Play size={14} aria-hidden="true" />
              {entry.label}
            </button>
          ))}
        </div>
        <p role="status" style={{ fontSize: 11, marginTop: 8 }}>
          {error
            ? `Playback issue: ${error}`
            : isLoading
              ? "Connecting to SoundCloud…"
              : currentTrack
                ? `${isPlaying ? "Playing" : "Paused"}: ${currentTrack.title} · ${currentTrack.artist}`
                : "Start a selection, then explore the desktop. Playback continues when you close the iPod."}
        </p>
      </section>
      <div
        style={{
          background: "radial-gradient(ellipse at 50% 35%, #c3cbbb, #9ca99a)",
          display: "flex",
          height:
            "min(540px, max(120px, calc(100dvh - 296px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))))",
          minHeight: 0,
          padding: "clamp(6px, 2vw, 20px)",
          width: "100%",
        }}
      >
        <IPodPlayer />
      </div>
    </WindowShell>
  )
}
