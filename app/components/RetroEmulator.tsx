"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Upload, X } from "lucide-react"

interface RetroEmulatorProps {
  core: string
  onClose: () => void
}

export default function RetroEmulator({ core, onClose }: RetroEmulatorProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [rom, setRom] = useState<File | null>(null)
  const [layout, setLayout] = useState("joystick")
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState("Choose a ROM file to begin.")
  const [error, setError] = useState(false)

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type !== "raffi-emulator:status") return
      if (event.data.status === "ready") {
        setError(false)
        setStatus("Press Start Game in the player. Touch controls appear on phones; keyboard controls remain available.")
      } else if (event.data.status === "playing") {
        setError(false)
        setStatus("Playing. Use the player menu to pause, save or change button mappings.")
      } else if (event.data.status === "error") {
        setError(true)
        setStatus("The emulator could not load. Check your connection and ROM format, then retry.")
      }
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [])

  const restart = () => {
    setError(false)
    setStatus("Loading emulator…")
    setRevision((value) => value + 1)
  }
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setRom(file)
    restart()
    event.target.value = ""
  }

  return (
    <div style={{ width: "100%", background: "#111827", borderRadius: 8, overflow: "hidden", color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, borderBottom: "1px solid #374151" }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Retro Emulator · {core.toUpperCase()}</h3>
        <button onClick={onClose} aria-label="Close emulator" className="hover:bg-gray-700 focus-visible:outline" style={{ display: "grid", placeItems: "center", minWidth: 44, minHeight: 44, borderRadius: 6 }}>
          <X size={20} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: 16, background: "#1f2937" }}>
        <label className="hover:bg-blue-700 focus-within:outline" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "8px 14px", background: "#2563eb", borderRadius: 6, cursor: "pointer" }}>
          <Upload size={16} /> Upload ROM file
          <input type="file" accept=".nes,.smc,.sfc,.gb,.gbc,.md,.gen,.zip" onChange={handleFileUpload} className="sr-only" />
        </label>
        <label style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 14 }}>
          Touch controls{rom ? " (restarts game)" : ""}
          <select aria-label="Emulator touch controls" value={layout} onChange={(event) => { setLayout(event.target.value); if (rom) restart() }} style={{ minHeight: 44, padding: "8px 12px", borderRadius: 6, background: "#374151", color: "white", fontSize: 16 }}>
            <option value="joystick">Joystick</option>
            <option value="dpad">D-pad</option>
          </select>
        </label>
        <p style={{ width: "100%", color: "#d1d5db", fontSize: 13 }}>Choose a ROM you own. Your file stays in this browser.</p>
      </div>
      <p role={error ? "alert" : "status"} style={{ padding: "12px 16px", color: error ? "#fca5a5" : "#d1d5db", fontSize: 14 }}>{status}</p>
      {error && <button onClick={restart} style={{ minHeight: 44, margin: "0 16px 16px", padding: "8px 16px", background: "#2563eb", borderRadius: 6 }}>Retry emulator</button>}
      {rom && (
        <iframe
          key={`${core}-${revision}`}
          ref={frameRef}
          src="/emulator/index.html"
          title={`${core.toUpperCase()} emulator player`}
          allow="autoplay; fullscreen; gamepad"
          allowFullScreen
          onLoad={() => frameRef.current?.contentWindow?.postMessage({ type: "raffi-emulator:load", core, file: rom, layout }, window.location.origin)}
          style={{ display: "block", width: "100%", height: "min(72dvh, 700px)", minHeight: 360, border: 0, background: "black" }}
        />
      )}
      <p style={{ padding: 16, fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>Move with the joystick, D-pad or arrow keys. Use the emulator’s Controls menu to view or change action keys. Rotate your phone for a wider game view.</p>
    </div>
  )
}
