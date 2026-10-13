"use client"

import { useCallback, useEffect, useState } from "react"

export type GameControlMode = "stick" | "buttons"

export function useGameControlMode(game: string): [GameControlMode, (mode: GameControlMode) => void] {
  const [mode, setMode] = useState<GameControlMode>("stick")
  const storageKey = `raffi-controls:${game}`
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      setMode(saved === "buttons" ? "buttons" : "stick")
    } catch { /* Controls remain usable when storage is unavailable. */ }
  }, [storageKey])
  const choose = useCallback((next: GameControlMode) => {
    setMode(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Private browsing may disable storage. */ }
  }, [storageKey])
  return [mode, choose]
}

export default function GameControlChoice({
  value,
  onChange,
  vertical = false,
}: {
  value: GameControlMode
  onChange: (mode: GameControlMode) => void
  /** Stack the two choices, for narrow side columns. */
  vertical?: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Movement control style"
      style={{ display: "inline-flex", flexDirection: vertical ? "column" : "row", flexWrap: vertical ? "nowrap" : "wrap", gap: 3 }}
    >
      {(["stick", "buttons"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className="hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          style={{ minHeight: 44, padding: "5px 9px", font: "inherit", fontSize: 11, fontWeight: 700, borderRadius: 5, border: `1px solid ${value === mode ? "#597dab" : "#8997a4"}`, background: value === mode ? "#d8e8fb" : "#e7eaed", color: "#1d354e", touchAction: "manipulation", cursor: "pointer" }}
        >
          {mode === "stick" ? "Thumbstick" : "Buttons"}
        </button>
      ))}
    </div>
  )
}
