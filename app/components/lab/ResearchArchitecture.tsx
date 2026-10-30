"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { ArrowLeft, ArrowRight, Building2, ExternalLink, Minus, Plus, RotateCcw, RotateCw } from "lucide-react"
import { getResearchArchitecture, RESEARCH_ARCHITECTURES, type ResearchArchitecture, type ResearchArchitectureId } from "@/data/research-architectures"
import type { ArchitectureSceneController, ArchitectureSceneState, RoomLabelPoint } from "./architecture-scene"

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#225fa5]"
const button: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 36, border: "1px solid #afbecb", background: "#fff", color: "#2b4860", borderRadius: 3, padding: "7px 10px", fontSize: 12, cursor: "pointer" }

function WorkflowDiagram({ architecture, selectedIndex, onEnter }: { architecture: ResearchArchitecture; selectedIndex: number; onEnter: (index: number) => void }) {
  const markerId = useId().replace(/:/g, "")
  return (
    <svg data-testid="architecture-diagram" role="img" aria-label={`${architecture.label} workflow, six connected stations. Use the room directory to enter a station.`} viewBox="0 0 900 420" style={{ display: "block", width: "100%", height: "100%", background: "#edf2f6" }}>
      <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#5b85ad" /></marker></defs>
      <text x="40" y="27" fill="#657e94" fontSize="14" fontFamily="Tahoma, sans-serif">{architecture.levels[0]}</text>
      <text x="40" y="252" fill="#657e94" fontSize="14" fontFamily="Tahoma, sans-serif">{architecture.levels[1]}</text>
      {[0, 1, 3, 4].map((index) => {
        const x = 280 + index % 3 * 290
        const y = index < 3 ? 102 : 327
        return <path key={index} d={`M${x},${y} H${x + 44}`} fill="none" stroke="#5b85ad" strokeWidth="2" markerEnd={`url(#${markerId})`} />
      })}
      <path d="M740,150 V195 H160 V268" fill="none" stroke="#5b85ad" strokeWidth="2" markerEnd={`url(#${markerId})`} />
      {architecture.stations.map((station, index) => {
        const x = 40 + index % 3 * 290
        const y = index < 3 ? 52 : 277
        const selected = selectedIndex === index
        return (
          <g key={station.id} onClick={() => onEnter(index)} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width="240" height="100" rx="3" fill={selected ? "#225fa5" : "#ffffff"} stroke={selected ? "#225fa5" : "#acbdcb"} strokeWidth={selected ? 3 : 1} />
            <text x={x + 14} y={y + 25} fill={selected ? "#cfdef0" : "#658098"} fontSize="13" fontFamily="monospace">{String(index + 1).padStart(2, "0")}</text>
            <text x={x + 14} y={y + 52} fill={selected ? "#ffffff" : "#253e54"} fontSize="18" fontWeight="bold" fontFamily="Tahoma, sans-serif">{station.title}</text>
            <text x={x + 14} y={y + 78} fill={selected ? "#dce8f4" : "#657b8e"} fontSize="12" fontFamily="Tahoma, sans-serif">{station.subtitle}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ResearchArchitecture({ active = true, motionPaused = false, initialProject = "dfah", onOpenResearch }: { active?: boolean; motionPaused?: boolean; initialProject?: ResearchArchitectureId; onOpenResearch?: () => void }) {
  const [projectId, setProjectId] = useState<ResearchArchitectureId>(initialProject)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [entered, setEntered] = useState(false)
  const [view, setView] = useState<"3d" | "2d">("3d")
  const [reducedMotion, setReducedMotion] = useState(true)
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<ArchitectureSceneController | null>(null)
  const architecture = getResearchArchitecture(projectId)
  const station = architecture.stations[selectedIndex]
  const sceneState = { architecture, selectedIndex, entered, active, motionPaused: motionPaused || reducedMotion }
  const stateRef = useRef<ArchitectureSceneState>(sceneState)
  stateRef.current = sceneState
  const selectRef = useRef<(index: number) => void>(() => {})
  const enterRef = useRef<(index: number) => void>(() => {})
  selectRef.current = (index) => setSelectedIndex(index)
  enterRef.current = (index) => { setSelectedIndex(index); setEntered(true) }
  const stageRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<Array<HTMLButtonElement | null>>([])
  const placeLabelsRef = useRef<(points: RoomLabelPoint[]) => void>(() => {})
  // Narrow stages show numbers only, except for the selected room.
  const [compactLabels, setCompactLabels] = useState(false)
  // The scene calls this every frame it draws; labels move without a React render.
  placeLabelsRef.current = (points) => {
    const stageWidth = stageRef.current?.clientWidth ?? 0
    points.forEach((point, index) => {
      const label = labelRefs.current[index]
      if (!label) return
      label.style.visibility = point.visible ? "visible" : "hidden"
      label.style.transform = `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) translate(-50%, -100%)`
      label.style.zIndex = String(index === selectedIndex ? 100 : Math.round(50 - point.depth * 40))
      // The pin stays on the room; only its card slides to stay on the stage.
      const card = label.firstElementChild as HTMLElement | null
      if (!card || !stageWidth) return
      const half = card.offsetWidth / 2 + 6
      const shift = Math.min(Math.max(point.x, half), Math.max(half, stageWidth - half)) - point.x
      card.style.transform = shift ? `translateX(${shift.toFixed(1)}px)` : ""
    })
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setCompactLabels(entry.contentRect.width < 700))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Labels mount after the scene's first frame, and change width in compact
  // mode; ask for one more frame so they are placed and kept on the stage.
  useEffect(() => {
    if (ready) controllerRef.current?.update(stateRef.current)
  }, [ready, compactLabels])

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReducedMotion(preference.matches)
    sync()
    preference.addEventListener("change", sync)
    return () => preference.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (view !== "3d") return
    let cancelled = false
    setReady(false)
    setUnavailable(false)
    import("./architecture-scene").then(({ createArchitectureScene }) => {
      if (cancelled || !hostRef.current) return
      controllerRef.current = createArchitectureScene(
        hostRef.current,
        stateRef.current,
        (index) => selectRef.current(index),
        (index) => enterRef.current(index),
        () => { if (!cancelled) setUnavailable(true) },
        (points) => placeLabelsRef.current(points),
      )
      setReady(true)
    }).catch(() => { if (!cancelled) setUnavailable(true) })
    return () => {
      cancelled = true
      controllerRef.current?.dispose()
      controllerRef.current = null
    }
  }, [view, attempt])

  useEffect(() => {
    controllerRef.current?.update({ architecture, selectedIndex, entered, active, motionPaused: motionPaused || reducedMotion })
  }, [architecture, selectedIndex, entered, active, motionPaused, reducedMotion])

  const enter = (index: number) => { setSelectedIndex(index); setEntered(true) }
  const overview = () => { setEntered(false); controllerRef.current?.overview() }
  const changeProject = (id: ResearchArchitectureId) => { setProjectId(id); setSelectedIndex(0); setEntered(false) }

  return (
    <section data-lab-experiment="architecture-studio" data-architecture-project={projectId} data-architecture-mode={entered ? "room" : "mall"} style={{ background: "#f6f8f9", color: "#263f53", border: "1px solid #b7c5cf", fontFamily: "Tahoma, Verdana, sans-serif" }}>
      <header style={{ padding: "16px 18px", borderBottom: "1px solid #c4d0d9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Building2 size={22} color="#225fa5" strokeWidth={1.7} aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: 21, letterSpacing: -0.6, fontWeight: 700 }}>Raffi’s Architecture Studio</h3>
        </div>
        <p style={{ margin: "6px 0 13px", fontSize: 12, lineHeight: 1.6, color: "#5b7285" }}>Enter a room. Follow the connections. See how the research works.</p>
        <div role="group" aria-label="Research projects" style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {RESEARCH_ARCHITECTURES.map((project) => <button type="button" key={project.id} aria-pressed={projectId === project.id} onClick={() => changeProject(project.id)} className={focus} style={{ ...button, background: projectId === project.id ? "#225fa5" : "#ffffff", color: projectId === project.id ? "#ffffff" : "#385770", borderColor: projectId === project.id ? "#225fa5" : "#b4c3cf", fontWeight: projectId === project.id ? 700 : 400 }}>{project.label}</button>)}
        </div>
      </header>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid #c4d0d9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, background: "#eef3f6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
          <button type="button" onClick={overview} className={focus} style={button}><ArrowLeft size={13} aria-hidden="true" />{entered ? "Back to mall" : "Overview"}</button>
          <span style={{ color: "#567084" }}>{entered ? `Inside room ${String(selectedIndex + 1).padStart(2, "0")}` : "Six connected rooms"}</span>
          {architecture.preview && <span style={{ border: "1px solid #b5a176", color: "#715f37", padding: "3px 6px", borderRadius: 2, fontSize: 10 }}>Research preview</span>}
        </div>
        <div role="group" aria-label="Architecture view" style={{ display: "flex", gap: 4 }}>
          <button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")} className={focus} style={{ ...button, background: view === "3d" ? "#dbe7f1" : "#fff" }}>3D mall</button>
          <button type="button" aria-pressed={view === "2d"} onClick={() => setView("2d")} className={focus} style={{ ...button, background: view === "2d" ? "#dbe7f1" : "#fff" }}>2D diagram</button>
        </div>
      </div>

      <div className="research-architecture-body" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div style={{ minWidth: 0, background: "#dde5ec" }}>
          <div ref={stageRef} style={{ position: "relative", height: "clamp(300px, 50vw, 460px)", minWidth: 0 }}>
            {view === "3d" ? <>
              <div ref={hostRef} data-testid="architecture-stage" role="img" aria-label={`${architecture.label}, six connected rooms in a cutaway research mall`} style={{ width: "100%", height: "100%", overflow: "hidden" }} />
              {ready && !unavailable && (
                // Visual twins of the room directory below, which is the keyboard and screen-reader route.
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                  {architecture.stations.map((entry, index) => {
                    const selected = index === selectedIndex
                    const inside = selected && entered
                    const titled = selected || (!compactLabels && !entered)
                    const tone = selected ? "#1f5b9e" : "#7d95aa"
                    return (
                      <button
                        key={`${architecture.id}-${entry.id}`}
                        ref={(node) => { labelRefs.current[index] = node }}
                        type="button"
                        tabIndex={-1}
                        data-room-label={index + 1}
                        onClick={() => enter(index)}
                        className="hover:brightness-110"
                        style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: 0, border: 0, background: "none", cursor: "pointer", opacity: entered && !selected ? 0.5 : 1, transition: "opacity 160ms ease-out" }}
                      >
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, whiteSpace: "nowrap", padding: inside ? "8px 12px 9px" : "5px 9px", background: selected ? "#1f5b9e" : "#ffffff", color: selected ? "#ffffff" : "#1b3044", border: `1px solid ${selected ? "#17497f" : "#90a7ba"}`, borderRadius: 3, boxShadow: "0 1px 0 rgba(27, 48, 68, 0.2), 0 6px 14px rgba(27, 48, 68, 0.16)", fontFamily: "Tahoma, Verdana, sans-serif", fontSize: inside ? 15 : 12.5, fontWeight: 700, lineHeight: 1.2, textAlign: "left" }}>
                          <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: inside ? 12 : 11, color: selected ? "#cde0f6" : "#225fa5" }}>{String(index + 1).padStart(2, "0")}</span>
                            {titled && <span>{entry.title}</span>}
                          </span>
                          {inside && <span style={{ fontSize: 12, fontWeight: 400, color: "#dce9f7" }}>{entry.subtitle}</span>}
                        </span>
                        <span style={{ width: 2, height: inside ? 14 : 10, background: tone }} />
                        <span style={{ width: 8, height: 8, marginTop: -1, borderRadius: "50%", background: tone, boxShadow: "0 0 0 2px #ffffff" }} />
                      </button>
                    )
                  })}
                </div>
              )}
              {(!ready || unavailable) && <div role="status" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: 24, background: "#dde5ec", color: "#547087", fontSize: 13 }}>
                <Building2 size={30} color="#6487a5" aria-hidden="true" />
                <span>{unavailable ? "The 3D view is unavailable. The diagram and room directory still work." : "Opening the architecture studio…"}</span>
                {unavailable && <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}><button type="button" onClick={() => setView("2d")} className={focus} style={button}>Show 2D diagram</button><button type="button" onClick={() => setAttempt((value) => value + 1)} className={focus} style={button}>Retry 3D</button></div>}
              </div>}
            </> : <WorkflowDiagram architecture={architecture} selectedIndex={selectedIndex} onEnter={enter} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 9, padding: "8px 12px", minHeight: 52, borderTop: "1px solid #c3ced8", fontSize: 10, color: "#61798d" }}>
            <span>{view === "3d" ? "Drag to orbit · scroll or pinch to zoom · tap a room’s label to step inside" : "The same workflow, shown as a diagram"}</span>
            {view === "3d" && <div role="group" aria-label="Studio camera controls" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button type="button" disabled={!ready || unavailable} aria-label="Rotate studio left" onClick={() => controllerRef.current?.rotate(-1)} className={focus} style={{ ...button, padding: 7 }}><RotateCcw size={13} /></button>
              <button type="button" disabled={!ready || unavailable} aria-label="Rotate studio right" onClick={() => controllerRef.current?.rotate(1)} className={focus} style={{ ...button, padding: 7 }}><RotateCw size={13} /></button>
              <button type="button" disabled={!ready || unavailable} aria-label="Zoom studio out" onClick={() => controllerRef.current?.zoom(-1)} className={focus} style={{ ...button, padding: 7 }}><Minus size={13} /></button>
              <button type="button" disabled={!ready || unavailable} aria-label="Zoom studio in" onClick={() => controllerRef.current?.zoom(1)} className={focus} style={{ ...button, padding: 7 }}><Plus size={13} /></button>
              <button type="button" disabled={!ready || unavailable} onClick={() => controllerRef.current?.overview(true)} className={focus} style={{ ...button, padding: "7px 9px" }}>Top view</button>
            </div>}
          </div>
        </div>

        <aside aria-label="Selected room" data-testid="architecture-inspector" style={{ padding: "18px 18px 15px", background: "#ffffff", borderTop: "1px solid #c4d0d9", minWidth: 0 }}>
          <p style={{ margin: "0 0 8px", color: "#6c8397", fontSize: 11 }}>{architecture.label} / Room {String(selectedIndex + 1).padStart(2, "0")}</p>
          <h4 style={{ margin: "0 0 6px", fontSize: 21, lineHeight: 1.2, letterSpacing: -0.5, fontWeight: 700 }}>{station.title}</h4>
          <p style={{ margin: "0 0 13px", fontSize: 12, color: "#638098" }}>{station.subtitle}</p>
          <p aria-live="polite" style={{ margin: "0 0 14px", fontSize: 12, color: "#465f73", lineHeight: 1.8 }}>{station.description}</p>
          {!entered && <button type="button" onClick={() => enter(selectedIndex)} className={focus} style={{ ...button, background: "#225fa5", color: "#fff", borderColor: "#225fa5", fontWeight: 700 }}>Enter room <ArrowRight size={13} aria-hidden="true" /></button>}
          {station.sourceUrl ? <a href={station.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${focus} hover:underline`} style={{ display: "flex", gap: 5, alignItems: "center", color: "#225fa5", padding: "12px 0 0", fontSize: 11, lineHeight: 1.6 }}><ExternalLink size={12} aria-hidden="true" />{station.sourceLabel}</a> : <p style={{ margin: "12px 0 0", color: "#7a705b", fontSize: 11, lineHeight: 1.6 }}>{station.sourceLabel}. No private materials are included.</p>}
        </aside>
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid #c4d0d9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#eef3f6" }}>
        <button type="button" disabled={selectedIndex === 0} onClick={() => enter(selectedIndex - 1)} className={`${focus} disabled:opacity-40 disabled:cursor-default`} style={button}><ArrowLeft size={13} aria-hidden="true" />Previous</button>
        <span aria-live="polite" style={{ fontSize: 11, color: "#5b7489", textAlign: "center" }}>{selectedIndex + 1} / {architecture.stations.length}{selectedIndex === architecture.stations.length - 1 ? " · End of route" : ""}</span>
        <button type="button" disabled={selectedIndex === architecture.stations.length - 1} onClick={() => enter(selectedIndex + 1)} className={`${focus} disabled:opacity-40 disabled:cursor-default`} style={button}>Next stop <ArrowRight size={13} aria-hidden="true" /></button>
      </div>

      <div style={{ padding: "15px 16px 17px", borderTop: "1px solid #c4d0d9" }}>
        <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>Room directory</h4>
        <div role="group" aria-label="Room directory" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 5 }}>
          {architecture.stations.map((entry, index) => <button type="button" key={entry.id} aria-label={`Enter room ${index + 1}: ${entry.title}`} aria-pressed={selectedIndex === index} onClick={() => enter(index)} className={focus} style={{ ...button, justifyContent: "flex-start", textAlign: "left", background: selectedIndex === index ? "#dbe7f1" : "#ffffff", borderColor: selectedIndex === index ? "#6489ad" : "#c4d0d9", gap: 9 }}><span style={{ color: "#648098", fontFamily: "monospace", fontSize: 11 }}>{String(index + 1).padStart(2, "0")}</span>{entry.title}</button>)}
        </div>
        <p style={{ margin: "13px 0 0", color: "#657c8f", fontSize: 11, lineHeight: 1.65 }}>{architecture.question}</p>
        <p style={{ margin: "8px 0 0", color: "#7c8c99", fontSize: 10, lineHeight: 1.6 }}>A spatial reading guide, rather than a deployment topology. Camera movement follows your actions; motion preferences remain respected.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
          {architecture.paperUrl && <a href={architecture.paperUrl} target="_blank" rel="noopener noreferrer" className={`${focus} hover:underline`} style={{ color: "#225fa5", fontSize: 11, padding: "5px 0" }}>Read the paper</a>}
          {architecture.sourceUrl && <a href={architecture.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${focus} hover:underline`} style={{ color: "#225fa5", fontSize: 11, padding: "5px 0" }}>Public repository</a>}
          {onOpenResearch && <button type="button" onClick={onOpenResearch} className={`${focus} hover:underline`} style={{ color: "#225fa5", fontSize: 11, padding: "5px 0" }}>More research</button>}
        </div>
      </div>
      <style jsx>{`
        @media (min-width: 900px) {
          .research-architecture-body { grid-template-columns: minmax(0, 1fr) 270px !important; }
          .research-architecture-body > aside { border-top: 0 !important; border-left: 1px solid #c4d0d9; }
        }
      `}</style>
    </section>
  )
}
