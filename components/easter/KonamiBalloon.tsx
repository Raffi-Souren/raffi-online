"use client"

import { useEffect, useRef, useState } from "react"
import { konamiStep } from "@/lib/desktop-extras"

const TAHOMA = "Tahoma, Verdana, 'Segoe UI', sans-serif"

/**
 * Up, Up, Down, Down, Left, Right, Left, Right, B, A on the desktop pops an
 * XP balloon that unlocks the emulator. Keys typed into a field or a game
 * never count, and the balloon opens the emulator in its own tab so the
 * desktop and anything running on it stay as they are.
 */
export default function KonamiBalloon({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const progress = useRef(0)
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    // A game or the terminal in front owns the arrow keys.
    if (!enabled) { progress.current = 0; return }
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      // A game owns its own keys.
      if (target instanceof HTMLElement && target.closest("canvas, iframe, [data-game-surface]")) return
      const step = konamiStep(progress.current, event.key)
      progress.current = step.progress
      if (step.done) setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => linkRef.current?.focus({ preventScroll: true }))
    const timer = window.setTimeout(() => setOpen(false), 25_000)
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onEscape)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-konami-balloon
      style={{
        position: "fixed", right: "max(10px, env(safe-area-inset-right, 0px))", bottom: "calc(52px + env(safe-area-inset-bottom, 0px))", zIndex: 9500,
        width: "min(300px, calc(100vw - 20px))", padding: "10px 12px 12px", fontFamily: TAHOMA, color: "#111827",
        background: "#ffffe1", border: "1px solid #000000", borderRadius: 8, boxShadow: "2px 3px 8px rgba(0, 0, 0, 0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Cheat code accepted</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close this balloon"
          className="hover:bg-[#f1e9a6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          style={{ width: 44, height: 44, margin: "-8px -10px -8px 0", border: "none", background: "transparent", fontSize: 16, cursor: "pointer", borderRadius: 4 }}
        >
          ×
        </button>
      </div>
      <p style={{ margin: "2px 0 10px", fontSize: 12.5, lineHeight: 1.5 }}>
        ↑ ↑ ↓ ↓ ← → ← → B A. The emulator is unlocked: NES, SNES, Game Boy and Genesis. Bring your own ROM.
      </p>
      <a
        ref={linkRef}
        href="/games/emulator"
        target="_blank"
        rel="noopener"
        onClick={() => setOpen(false)}
        className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 14px", fontSize: 13, color: "#111827", textDecoration: "none", background: "linear-gradient(#ffffff, #ece9d8)", border: "1px solid #003c74", borderRadius: 3 }}
      >
        Open the emulator
      </a>
      {/* The balloon's tail, pointing at the tray. */}
      <span aria-hidden="true" style={{ position: "absolute", right: 22, bottom: -9, width: 16, height: 16, background: "#ffffe1", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", transform: "rotate(45deg)" }} />
    </div>
  )
}
