"use client"

import { useRef } from "react"
import { CassetteTape, FileText, LoaderCircle, Pause, Play, X } from "lucide-react"
import { BADCOMPANY_MIXES } from "@/data/audio-library"
import { useAudio } from "../context/AudioContext"

interface DesktopWelcomeProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onAbout: () => void
  onExplore: () => void
}

export default function DesktopWelcome({ collapsed, onCollapsedChange: setCollapsed, onAbout, onExplore }: DesktopWelcomeProps) {
  const titleRef = useRef<HTMLButtonElement>(null)
  const { currentTrack, isPlaying, isLoading, needsTap, error, setPlaylist, playTrack, togglePlay } = useAudio()
  const mixSelected = Boolean(currentTrack && BADCOMPANY_MIXES.some((mix) => mix.id === currentTrack.id))
  const playingMix = mixSelected && isPlaying

  const playMix = () => {
    if (mixSelected) {
      if (error && currentTrack) playTrack(currentTrack)
      else togglePlay()
      return
    }
    setPlaylist(BADCOMPANY_MIXES)
    playTrack(BADCOMPANY_MIXES[0])
  }

  const actionStyle = {
    minHeight: 44,
    border: 0,
    padding: "0 8px",
    background: "transparent",
    color: "#244b82",
    cursor: "pointer",
    fontSize: 12,
  } as const
  const focusClass = "hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"

  return (
    <section
      className="desktop-welcome"
      data-desktop-welcome="true"
      data-collapsed={collapsed}
      aria-label="Welcome to Raffi’s computer"
      style={{
        border: "1px solid #8fa7c5",
        borderRadius: 6,
        background: "#fffef8",
        color: "#252b35",
        boxShadow: "0 5px 18px #122c4e30, inset 0 0 0 1px #ffffff",
        fontFamily: "Tahoma, Verdana, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", borderRadius: "5px 5px 0 0", background: "linear-gradient(#f6f9ff, #dce7f6)", borderBottom: collapsed ? 0 : "1px solid #c1cddd" }}>
        <button
          ref={titleRef}
          type="button"
          aria-expanded={!collapsed}
          aria-controls="desktop-welcome-content"
          onClick={() => setCollapsed(!collapsed)}
          className={focusClass}
          style={{ ...actionStyle, flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "0 12px", textAlign: "left", minHeight: 36 }}
        >
          <FileText size={14} aria-hidden="true" />
          welcome.txt
          {collapsed && <span style={{ marginLeft: "auto", color: "#52657e", fontSize: 10 }}>open</span>}
        </button>
        {!collapsed && (
          <button
            type="button"
            aria-label="Minimize welcome"
            onClick={() => { setCollapsed(true); titleRef.current?.focus() }}
            className="hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            style={{ ...actionStyle, minHeight: 36, width: 36, display: "grid", placeItems: "center" }}
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      <div id="desktop-welcome-content" hidden={collapsed} style={{ padding: "16px 18px 12px" }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5, margin: "0 0 8px" }}>Hey, I’m Raffi.<br />Welcome to my computer.</h1>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: "#515865", margin: "0 0 14px" }}>
          Music I listen to, games to play, and things I’m making and breaking.
        </p>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
          <button
            type="button"
            onClick={playMix}
            aria-label={mixSelected && error ? "Retry mix" : mixSelected && needsTap ? "Tap to play" : mixSelected && isLoading ? "Tuning in…" : playingMix ? "Pause mix" : mixSelected ? "Resume mix" : "Play a mix"}
            className="group hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 48, padding: "6px 10px", border: "1px solid #202b36", borderRadius: 5, background: "#303b46", color: "#fffbee", cursor: "pointer", marginRight: 3, boxShadow: "inset 0 1px 0 #ffffff25, 0 2px 0 #00000015" }}
          >
            <CassetteTape size={28} strokeWidth={1.3} aria-hidden="true" />
            <span style={{ display: "grid", textAlign: "left", gap: 2 }}>
              <span style={{ fontSize: 9, letterSpacing: ".08em", color: "#d9c5a4" }}>BADCO · SIDE A</span>
              <span style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                {mixSelected && isLoading && !needsTap ? <LoaderCircle size={11} className="motion-safe:animate-spin" aria-hidden="true" /> : playingMix && !needsTap ? <Pause size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
                {mixSelected && error ? "Try again" : mixSelected && needsTap ? "Tap to play" : mixSelected && isLoading ? "Tuning in…" : playingMix ? "Pause mix" : mixSelected ? "Resume mix" : "Play a mix"}
              </span>
            </span>
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
            <button type="button" onClick={() => { setCollapsed(true); onExplore() }} className={focusClass} style={actionStyle}>Explore</button>
            <span aria-hidden="true" style={{ color: "#a7abb1", fontSize: 11 }}>·</span>
            <button type="button" onClick={onAbout} className={focusClass} style={actionStyle}>About me</button>
          </span>
        </div>
        {mixSelected && error && <p role="status" style={{ fontSize: 11, lineHeight: 1.5, color: "#92400e", margin: "8px 0 0" }}>The mix didn’t start. Tap to try again.</p>}
      </div>
    </section>
  )
}
