"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Box, Layers, Minus, Plus, RotateCcw, RotateCw } from "lucide-react"
import { useMotionPreference } from "@/app/context/MotionContext"
import type { GearSceneController, GearSceneState, GearSetup } from "./gear-scene"

const PARTS = [
  { layer: 4, label: "Vinyl + tonearms", color: "#c6a55a", description: "The stylus follows the record groove. The gold tonearm carries that small electrical signal out of each deck." },
  { layer: 3, label: "Hands-on controls", color: "#9cb9c3", description: "Pitch, EQ and level are the points where your hands shape the set. The rotary setup trades channel faders for large level knobs." },
  { layer: 2, label: "Top panels", color: "#7b8f85", description: "Two sage-green Technics decks frame either the white XDJ-XZ or a compact black rotary mixer." },
  { layer: 1, label: "Signal path", color: "#56816e", description: "Record → cartridge → phono input → mixer → master out. These schematic boards show the route, rather than the actual circuitry." },
  { layer: 0, label: "Chassis", color: "#7a8693", description: "The dark base and isolation feet support the decks. Keeping vibration away from the stylus helps the record play cleanly." },
]

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9bd77]"
const buttonStyle: CSSProperties = {
  minHeight: 36, padding: "7px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  border: "1px solid #52657a", borderRadius: 3, background: "#23364d", color: "#e4ebef", cursor: "pointer", fontSize: 12,
}

export default function GearAnatomy({ active = true, motionPaused = false }: { active?: boolean; motionPaused?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GearSceneController | null>(null)
  const [setup, setSetup] = useState<GearSetup>("xdj")
  const [separation, setSeparation] = useState(0)
  const [selectedLayer, setSelectedLayer] = useState(4)
  const [autoRotate, setAutoRotate] = useState(false)
  const { reducedMotion } = useMotionPreference()
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // The shared preference keeps motion off until the visitor's OS setting is read.
  const effectivePause = motionPaused || reducedMotion
  const stateRef = useRef<GearSceneState>({ setup, separation, selectedLayer, active, motionPaused: effectivePause, autoRotate })
  stateRef.current = { setup, separation, selectedLayer, active, motionPaused: effectivePause, autoRotate }

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setUnavailable(false)
    import("./gear-scene").then(({ createGearScene }) => {
      if (cancelled || !hostRef.current) return
      const controller = createGearScene(hostRef.current, () => {
        if (!cancelled) setUnavailable(true)
      })
      sceneRef.current = controller
      controller.update(stateRef.current)
      setReady(true)
    }).catch(() => { if (!cancelled) setUnavailable(true) })
    return () => {
      cancelled = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [attempt])

  useEffect(() => {
    sceneRef.current?.update({ setup, separation, selectedLayer, active, motionPaused: effectivePause, autoRotate })
  }, [setup, separation, selectedLayer, active, effectivePause, autoRotate])

  const selectedPart = PARTS.find((part) => part.layer === selectedLayer) ?? PARTS[0]

  return (
    <section data-lab-experiment="gear-anatomy" style={{ background: "#112137", color: "#e5ebef", fontFamily: "Tahoma, Verdana, sans-serif", border: "1px solid #334b65" }}>
      <div style={{ padding: "16px 18px 12px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>Two decks. Two setups.</h3>
          <p style={{ margin: "6px 0 0", color: "#adbecd", fontSize: 12, lineHeight: 1.5 }}>Green Technics, gold hardware. Change what sits between them.</p>
        </div>
        <div role="group" aria-label="Center equipment" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {([{ id: "xdj", label: "White XDJ-XZ" }, { id: "rotary", label: "Black rotary" }] as const).map((option) => (
            <button key={option.id} type="button" aria-pressed={setup === option.id} onClick={() => setSetup(option.id)} className={focusClass}
              style={{ ...buttonStyle, background: setup === option.id ? "#e4e8df" : "#23364d", color: setup === option.id ? "#1b2b36" : "#d3dfe7", borderColor: setup === option.id ? "#e4e8df" : "#52657a", fontWeight: setup === option.id ? 700 : 400 }}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gear-anatomy-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", borderTop: "1px solid #334b65" }}>
        <div style={{ minWidth: 0, position: "relative" }}>
          <div ref={hostRef} data-testid="gear-stage" aria-label={`Illustrative 3D setup: two green Technics decks and ${setup === "xdj" ? "a white XDJ-XZ" : "a compact black rotary mixer"}`}
            role="img" style={{ width: "100%", height: "clamp(245px, 45vw, 390px)", overflow: "hidden" }} />
          {(!ready || unavailable) && (
            <div role="status" style={{ position: "absolute", inset: "0 0 38px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", background: "#112137", fontSize: 13, color: "#c4d2dd" }}>
              <Box size={28} color="#c6a55a" aria-hidden="true" />
              {unavailable ? <>
                <span>The 3D view needs WebGL. You can still explore the parts below.</span>
                <button type="button" className={focusClass} style={buttonStyle} onClick={() => setAttempt((value) => value + 1)}>Try 3D again</button>
              </> : <span>Setting up the decks…</span>}
            </div>
          )}
          <div style={{ padding: "4px 14px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, color: "#9eb1c3", fontSize: 11 }}>
            <span>Drag to turn · scroll or pinch to zoom</span>
            <div role="group" aria-label="Camera controls" style={{ display: "flex", gap: 4 }}>
              <button type="button" aria-label="Rotate setup left" disabled={!ready || unavailable} onClick={() => sceneRef.current?.rotate(-1)} className={focusClass} style={{ ...buttonStyle, padding: 7 }}><RotateCcw size={14} /></button>
              <button type="button" aria-label="Rotate setup right" disabled={!ready || unavailable} onClick={() => sceneRef.current?.rotate(1)} className={focusClass} style={{ ...buttonStyle, padding: 7 }}><RotateCw size={14} /></button>
              <button type="button" aria-label="Zoom out" disabled={!ready || unavailable} onClick={() => sceneRef.current?.zoom(-1)} className={focusClass} style={{ ...buttonStyle, padding: 7 }}><Minus size={14} /></button>
              <button type="button" aria-label="Zoom in" disabled={!ready || unavailable} onClick={() => sceneRef.current?.zoom(1)} className={focusClass} style={{ ...buttonStyle, padding: 7 }}><Plus size={14} /></button>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 16px", borderTop: "1px solid #334b65", background: "#172940", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className={focusClass} aria-pressed={separation > 0} onClick={() => setSeparation(separation > 0 ? 0 : 1)}
              style={{ ...buttonStyle, background: "#c6a55a", borderColor: "#d9bd77", color: "#1a2530", fontWeight: 700, minHeight: 40 }}><Layers size={15} />{separation > 0 ? "Assemble" : "Disassemble"}</button>
            <button type="button" className={focusClass} onClick={() => sceneRef.current?.reset(false)} style={buttonStyle}>Reset view</button>
            <button type="button" className={focusClass} onClick={() => sceneRef.current?.reset(true)} style={buttonStyle}>Top view</button>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0", fontSize: 12, color: "#c9d6df" }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>Layer separation <output>{Math.round(separation * 100)}%</output></span>
            <input type="range" min="0" max="1" step="0.01" value={separation} aria-label="Layer separation" onChange={(event) => setSeparation(Number(event.target.value))} className={focusClass} style={{ width: "100%", accentColor: "#c6a55a", minHeight: 24, cursor: "pointer", margin: 0 }} />
          </label>
          <div role="group" aria-label="Equipment layers" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {PARTS.map((part, index) => (
              <button type="button" key={part.layer} aria-pressed={selectedLayer === part.layer} onClick={() => setSelectedLayer(part.layer)} className={focusClass}
                style={{ ...buttonStyle, width: "100%", justifyContent: "flex-start", padding: "8px 9px", minHeight: 37, background: selectedLayer === part.layer ? "#2b4259" : "transparent", borderColor: selectedLayer === part.layer ? "#6b8398" : "transparent" }}>
                <span style={{ color: "#9fb3c3", fontFamily: "monospace", width: 20, fontSize: 11 }}>{String(index + 1).padStart(2, "0")}</span>
                <span aria-hidden="true" style={{ width: 8, height: 8, background: part.color, marginRight: 3 }} />
                {part.label}
              </button>
            ))}
          </div>
          <p aria-live="polite" style={{ fontSize: 12, color: "#bccbd6", lineHeight: 1.65, margin: "12px 0", minHeight: 60 }}>{selectedPart.description}</p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 36, fontSize: 12, color: "#c9d6df", cursor: effectivePause ? "default" : "pointer" }}>
            <input type="checkbox" checked={autoRotate} disabled={effectivePause} onChange={(event) => setAutoRotate(event.target.checked)} className={focusClass} style={{ accentColor: "#c6a55a", width: 16, height: 16 }} />
            Auto-rotate{effectivePause ? " (motion paused)" : ""}
          </label>
        </div>
      </div>
      <p style={{ margin: 0, padding: "10px 16px", borderTop: "1px solid #334b65", color: "#9eb1c3", fontSize: 10, lineHeight: 1.5 }}>An illustrative model of Raffi&apos;s two setups. The internal layers are schematic.</p>
      <style jsx>{`
        @media (min-width: 840px) {
          .gear-anatomy-layout { grid-template-columns: minmax(0, 1fr) 245px !important; }
          .gear-anatomy-layout > div:last-child { border-top: 0 !important; border-left: 1px solid #334b65; }
        }
      `}</style>
    </section>
  )
}
