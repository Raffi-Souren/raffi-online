"use client"

import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

interface GameShelfNavProps {
  onBack: () => void
  /** Trim height for short landscape viewports. */
  compact?: boolean
  children?: ReactNode
}

/** Consistent "back to the shelf" strip shared by every game window. */
export default function GameShelfNav({ onBack, compact = false, children }: GameShelfNavProps) {
  return (
    <nav
      aria-label="Game navigation"
      className="game-touch"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: compact ? "2px 8px" : "4px 10px",
        background: "#e9ece2",
        borderBottom: "1px solid #aeb9b7",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          gap: 6,
          alignItems: "center",
          minHeight: compact ? 36 : 44,
          padding: "4px 10px",
          fontSize: 12,
          color: "#294b67",
          fontWeight: 700,
          borderRadius: 3,
        }}
        className="hover:bg-white active:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        <ArrowLeft size={15} /> Game shelf
      </button>
      {children}
    </nav>
  )
}
