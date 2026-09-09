"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { useAudio } from "../context/AudioContext"

/** The real, user-owned DJ instrument. Leaving removes its audio context. */
export default function GhostDeckStation({ active, onBack }: { active: boolean; onBack: () => void }) {
  const { pauseTrack } = useAudio()
  const back = useRef<HTMLButtonElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    pauseTrack()
    back.current?.focus()
    if (!active) setLoaded(false)
  }, [active, pauseTrack])
  return (
    <section role="dialog" aria-modal="true" aria-label="Ghost Deck DJ station" style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "#080a10", color: "#ebe2c9" }}>
      <header style={{ flexShrink: 0, display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", background: "#172822", borderBottom: "1px solid #536056" }}>
        <button ref={back} type="button" onClick={onBack} style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", border: "1px solid #b8b58b", borderRadius: 6, background: "#e9ddba", color: "#14271f", cursor: "pointer", fontSize: 12 }}><ArrowLeft size={16} /> Back to the records</button>
        <span style={{ fontSize: 11, flex: 1 }}>Your set, your way.</span>
        <a href="https://raffi-souren.github.io/ghost-deck/" target="_blank" rel="noopener noreferrer" aria-label="Open Ghost Deck in its own tab" style={{ color: "#e9ddba", padding: 8 }}><ExternalLink size={17} /></a>
      </header>
      {!loaded && <p role="status" style={{ padding: "8px 16px", margin: 0, fontSize: 12 }}>Opening Ghost Deck… Choose “Load a demo session” to get started.</p>}
      {active && <iframe title="Ghost Deck — real two-deck DJ demo" src="https://raffi-souren.github.io/ghost-deck/" onLoad={() => setLoaded(true)} allow="autoplay" sandbox="allow-scripts allow-same-origin allow-downloads" referrerPolicy="strict-origin-when-cross-origin" style={{ width: "100%", flex: 1, minHeight: 0, border: 0, background: "#080a10" }} />}
    </section>
  )
}
