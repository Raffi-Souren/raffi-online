"use client"

import { useRef } from "react"
import { Compass, FileText, LoaderCircle, Minus, Pause, Play, UserRound, X } from "lucide-react"
import { BADCOMPANY_MIXES } from "@/data/audio-library"
import { useAudio } from "../context/AudioContext"
import { useMotionPreference } from "../context/MotionContext"

interface DesktopWelcomeProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onAbout: () => void
  onExplore: () => void
  onDismiss: () => void
}

// The same blue as every window's title bar, so the welcome reads as part of the OS.
const TITLE_BAR = "linear-gradient(180deg, #3b82f6 0%, #2464dd 45%, #1c55c5 100%)"

/** A cassette whose reels turn while the mix plays and stop where they are when it pauses. */
function Cassette() {
  const reel = (cx: number) => (
    <g className="welcome-reel">
      <circle cx={cx} cy={20.5} r={3.7} fill="#e9edf2" />
      <circle cx={cx} cy={20.5} r={1.7} fill="#10151b" />
      {[0, 120, 240].map((angle) => (
        <rect key={angle} x={cx - 0.45} y={18.7} width={0.9} height={1.2} fill="#e9edf2" transform={`rotate(${angle} ${cx} 20.5)`} />
      ))}
    </g>
  )
  return (
    <svg width={64} height={40} viewBox="0 0 76 48" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <rect x={0.5} y={0.5} width={75} height={47} rx={5} fill="#1b2027" stroke="#5a6470" />
      {[[3.5, 3.5], [72.5, 3.5], [3.5, 44.5], [72.5, 44.5]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill="#5a6470" />
      ))}
      <rect x={6} y={5} width={64} height={27} rx={2.5} fill="#f2e6c8" />
      <rect x={6} y={8.5} width={64} height={2.6} fill="#e8692f" />
      <rect x={16} y={13.5} width={44} height={14} rx={7} fill="#10151b" />
      {/* More tape on the left spool: side A is at the start. */}
      <circle cx={27} cy={20.5} r={6.1} fill="#5c3e27" />
      <circle cx={49} cy={20.5} r={4.6} fill="#5c3e27" />
      {reel(27)}
      {reel(49)}
      <path d="M17 47.5 L21 37 H55 L59 47.5 Z" fill="#272e37" stroke="#5a6470" strokeWidth={0.6} />
      <circle cx={26} cy={42.5} r={1.6} fill="#10151b" />
      <circle cx={50} cy={42.5} r={1.6} fill="#10151b" />
    </svg>
  )
}

export default function DesktopWelcome({ collapsed, onCollapsedChange: setCollapsed, onAbout, onExplore, onDismiss }: DesktopWelcomeProps) {
  const titleRef = useRef<HTMLButtonElement>(null)
  const { currentTrack, isPlaying, isLoading, needsTap, error, setPlaylist, playTrack, togglePlay } = useAudio()
  const { reducedMotion } = useMotionPreference()
  const mixSelected = Boolean(currentTrack && BADCOMPANY_MIXES.some((mix) => mix.id === currentTrack.id))
  const playingMix = mixSelected && isPlaying
  const loading = mixSelected && isLoading && !needsTap
  const deck = mixSelected && error ? "error" : loading ? "loading" : playingMix && !needsTap ? "playing" : "idle"
  const label = mixSelected && error ? "Try again" : mixSelected && needsTap ? "Tap to play" : loading ? "Tuning in…" : playingMix ? "Pause mix" : mixSelected ? "Resume mix" : "Play a mix"

  const playMix = () => {
    if (mixSelected) {
      if (error && currentTrack) playTrack(currentTrack)
      else togglePlay()
      return
    }
    setPlaylist(BADCOMPANY_MIXES)
    playTrack(BADCOMPANY_MIXES[0])
  }

  const linkStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    border: 0,
    padding: "0 9px",
    background: "transparent",
    color: "#21487f",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
  } as const
  const linkClass = "hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
  const chromeFocus = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"

  return (
    <section
      className="desktop-welcome"
      data-desktop-welcome="true"
      data-collapsed={collapsed}
      data-motion-paused={reducedMotion}
      aria-label="Welcome to Raffi’s computer"
      style={{
        border: "1px solid #3c76c8",
        borderRadius: 7,
        background: "#f7f9ff",
        color: "#252b35",
        boxShadow: "0 5px 18px rgba(12, 32, 64, 0.24)",
        fontFamily: "Tahoma, Verdana, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          minHeight: 44,
          // Rounded here rather than clipping the card: a clipped grid item may shrink below its content on phones.
          borderRadius: collapsed ? 6 : "6px 6px 0 0",
          background: TITLE_BAR,
          color: "white",
          borderBottom: collapsed ? 0 : "1px solid #17449f",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28)",
        }}
      >
        {!collapsed && (
          <button
            type="button"
            aria-label="Minimize welcome"
            title="Minimize"
            onClick={() => { setCollapsed(true); titleRef.current?.focus() }}
            className={`group ${chromeFocus}`}
            style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 3, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #85baff, #246ae4)", border: "1px solid #b9d8ff", color: "#ffffff" }}>
              <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        )}
        <button
          ref={titleRef}
          type="button"
          aria-expanded={!collapsed}
          aria-controls="desktop-welcome-content"
          onClick={() => setCollapsed(!collapsed)}
          className={chromeFocus}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 7,
            padding: collapsed ? "0 12px" : 0,
            border: 0,
            background: "transparent",
            color: "white",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".01em",
            textShadow: "0 1px 1px rgba(10, 30, 80, 0.45)",
          }}
        >
          <FileText size={14} aria-hidden="true" />
          welcome.txt
          {collapsed && <span style={{ marginLeft: "auto", color: "#d5e4ff", fontSize: 11, fontWeight: 400 }}>open</span>}
        </button>
        <button
          type="button"
          aria-label="Dismiss welcome"
          title="Dismiss welcome"
          onClick={onDismiss}
          className={chromeFocus}
          style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
        >
          <span style={{ width: 20, height: 20, borderRadius: 3, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #ef9c86, #d6371e)", border: "1px solid #ffc5b5", color: "#ffffff" }}>
            <X size={12} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div id="desktop-welcome-content" hidden={collapsed} style={{ padding: "10px 12px 2px" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: "#1b2330" }}>Hey, I’m Raffi.</h1>
        <p style={{ fontSize: 12, lineHeight: 1.45, color: "#515865", margin: "4px 0 10px" }}>
          Music, games, and things I’m making.
        </p>

        <button
          type="button"
          onClick={playMix}
          data-deck={deck}
          aria-label={mixSelected && error ? "Retry mix" : label}
          className="welcome-deck focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          style={{
            width: "100%",
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "7px 8px",
            border: "1px solid #151a20",
            borderRadius: 5,
            background: "linear-gradient(180deg, #3a4552 0%, #262e38 100%)",
            color: "#fffbee",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 2px 0 rgba(0, 0, 0, 0.18)",
          }}
        >
          <Cassette />
          <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: "#dcc8a6" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {mixSelected && currentTrack ? `SIDE A · ${currentTrack.title}` : "BADCO · SIDE A"}
              </span>
              {deck === "playing" && (
                <span className="welcome-eq" aria-hidden="true">
                  <span /><span /><span /><span />
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
          </span>
          <span
            aria-hidden="true"
            style={{ width: 28, height: 28, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", background: "#f2e6c8", color: "#1b2027", boxShadow: "inset 0 -2px 0 rgba(0, 0, 0, 0.18)" }}
          >
            {deck === "loading" ? (
              <LoaderCircle size={14} className={reducedMotion ? undefined : "motion-safe:animate-spin"} />
            ) : deck === "playing" ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />
            )}
          </span>
        </button>
        {mixSelected && error && <p role="status" style={{ fontSize: 11, lineHeight: 1.5, color: "#92400e", margin: "8px 0 0" }}>The mix didn’t start. Tap to try again.</p>}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <button type="button" aria-label="Open Lab" onClick={() => { setCollapsed(true); onExplore() }} className={linkClass} style={linkStyle}>
            <Compass size={14} aria-hidden="true" />
            Open Lab
          </button>
          <button type="button" onClick={onAbout} className={linkClass} style={linkStyle}>
            <UserRound size={14} aria-hidden="true" />
            About me
          </button>
        </div>
      </div>
    </section>
  )
}
