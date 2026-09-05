"use client"

import type { CSSProperties, ReactNode } from "react"
import { Heart, List, Pause, Play, RotateCcw, X } from "lucide-react"
import { formatTime } from "@/lib/game-utils"

interface GameControlsProps {
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
  score: number
  level: number
  lives?: number
  timeElapsed?: number
  showLevelSelect?: () => void
}

const shellButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  flex: "1 1 0",
  minWidth: 44,
  minHeight: 44,
  padding: "6px 8px",
  border: "1px solid #8c988d",
  borderRadius: 6,
  background: "#e4e6da",
  color: "#334835",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  boxShadow: "0 3px 0 #97a494, inset 1px 1px 0 #fbfbf3",
  touchAction: "manipulation",
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <span style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#6a7a6c" }}>{label}</span>
      <strong style={{ fontSize: 15, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{children}</strong>
    </div>
  )
}

export default function GameControls({
  isPaused,
  onPause,
  onResume,
  onRestart,
  onQuit,
  score,
  level,
  lives,
  timeElapsed,
  showLevelSelect,
}: GameControlsProps) {
  return (
    <div
      role="group"
      aria-label="Game controls"
      className="game-touch"
      style={{
        width: "min(100%, 360px)",
        padding: "10px 12px 12px",
        border: "1px solid #adb3aa",
        borderRadius: 12,
        background: "linear-gradient(120deg, #f0f0e6, #dcded3)",
        boxShadow: "inset 2px 2px 0 #fff, inset -3px -3px 1px #b8bfb5, 0 4px 0 #99a39a",
        color: "#364938",
        fontFamily: "'Trebuchet MS', Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          marginBottom: 10,
          padding: "6px 10px",
          background: "#9bbb58",
          border: "3px solid #626d67",
          borderRadius: 5,
          boxShadow: "inset 0 2px 4px #0004",
          color: "#1f2f1c",
        }}
      >
        <Stat label="Score">{score.toLocaleString()}</Stat>
        <Stat label="Level">{level}</Stat>
        {typeof lives === "number" && (
          <Stat label="Lives">
            <span
              aria-label={`${lives} lives`}
              style={{ display: "inline-flex", gap: 2, minHeight: 18, alignItems: "center" }}
            >
              {Array.from({ length: Math.max(0, lives) }, (_, i) => (
                <Heart key={i} size={13} fill="currentColor" aria-hidden="true" />
              ))}
            </span>
          </Stat>
        )}
        {typeof timeElapsed === "number" && <Stat label="Time">{formatTime(timeElapsed)}</Stat>}
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        {isPaused ? (
          <button
            type="button"
            onClick={onResume}
            style={{ ...shellButton, background: "#c9d9a3", borderColor: "#7f9660" }}
            className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            <Play size={15} fill="currentColor" aria-hidden="true" /> Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            style={{ ...shellButton, background: "#f1dfa1", borderColor: "#b39a4e" }}
            className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            <Pause size={15} aria-hidden="true" /> Pause
          </button>
        )}

        <button
          type="button"
          onClick={onRestart}
          style={shellButton}
          className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
        >
          <RotateCcw size={15} aria-hidden="true" /> Restart
        </button>

        {showLevelSelect && (
          <button
            type="button"
            onClick={showLevelSelect}
            style={shellButton}
            className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            <List size={15} aria-hidden="true" /> Levels
          </button>
        )}

        <button
          type="button"
          onClick={onQuit}
          aria-label="Quit to menu"
          style={{ ...shellButton, flex: "0 0 auto", background: "#e7c9cf", borderColor: "#9d6a76" }}
          className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
