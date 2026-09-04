"use client"

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react"
import { Flag, Hammer, HardHat, Pause, Play, RotateCcw, Shield, Warehouse } from "lucide-react"
import {
  buildDockyard,
  createDockyard,
  DOCKYARD_COSTS,
  DOCKYARD_HEIGHT,
  DOCKYARD_WIDTH,
  orderDockyard,
  tickDockyard,
  trainDockyard,
  type DockyardPoint,
  type DockyardState,
} from "@/lib/dockyard-engine"

const palette = {
  sea: "#204850",
  ground: "#d0c6a7",
  paper: "#f3ecd9",
  ink: "#243b3b",
  crew: "#197986",
  rival: "#b44836",
  gold: "#dbb752",
}
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`

function drawDockyard(
  ctx: CanvasRenderingContext2D,
  state: DockyardState,
  selected: number[],
  placement: "workshop" | "sentry" | null,
  pointer: DockyardPoint | null,
) {
  ctx.fillStyle = palette.sea
  ctx.fillRect(0, 0, DOCKYARD_WIDTH, DOCKYARD_HEIGHT)
  ctx.lineWidth = 1
  ctx.strokeStyle = "#83aca633"
  for (let y = 12; y < 500; y += 17) {
    ctx.beginPath()
    for (let x = 0; x <= 840; x += 10) {
      const wave = Math.sin(x / 46 + y + state.time * 0.65) * 2.5
      if (x === 0) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.stroke()
  }
  ctx.fillStyle = "#102d3480"
  ctx.fillRect(46, 60, 755, 394)
  ctx.fillStyle = palette.ground
  ctx.fillRect(38, 48, 760, 395)
  ctx.fillStyle = "#a6a58e"
  for (let x = 77; x < 760; x += 133) ctx.fillRect(x, 443, 63, 31)
  ctx.strokeStyle = "#877f6933"
  ctx.lineWidth = 1
  for (let x = 40; x <= 798; x += 38) {
    ctx.beginPath()
    ctx.moveTo(x, 48)
    ctx.lineTo(x, 443)
    ctx.stroke()
  }
  for (let y = 48; y <= 443; y += 38) {
    ctx.beginPath()
    ctx.moveTo(38, y)
    ctx.lineTo(798, y)
    ctx.stroke()
  }
  ctx.lineWidth = 44
  ctx.strokeStyle = "#989c8a"
  ctx.beginPath()
  ctx.moveTo(40, 410)
  ctx.lineTo(340, 240)
  ctx.lineTo(800, 240)
  ctx.stroke()
  ctx.setLineDash([12, 12])
  ctx.lineWidth = 2
  ctx.strokeStyle = "#e4d6a2"
  ctx.beginPath()
  ctx.moveTo(40, 410)
  ctx.lineTo(340, 240)
  ctx.lineTo(800, 240)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = "#6b70603a"
  ctx.lineWidth = 2
  for (let i = 0; i < 85; i++) {
    const x = 52 + ((i * 83) % 730),
      y = 62 + ((i * 47) % 360)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 3, y + 1)
    ctx.stroke()
  }
  for (const x of [328, 594]) {
    ctx.fillStyle = "#17353d55"
    ctx.fillRect(x + 6, 76, 18, 78)
    ctx.strokeStyle = "#b58c37"
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(x, 83)
    ctx.lineTo(x, 13)
    ctx.lineTo(x + 100, 13)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, 50)
    ctx.lineTo(x + 70, 13)
    ctx.moveTo(x + 90, 14)
    ctx.lineTo(x + 90, 47)
    ctx.stroke()
    ctx.fillStyle = "#45534b"
    ctx.fillRect(x - 10, 75, 20, 12)
  }
  ctx.font = "bold 13px 'Trebuchet MS', sans-serif"
  ctx.fillStyle = "#f3ecd9aa"
  ctx.fillText("NORTH PIER", 48, 30)
  ctx.fillText("EAST RIVER", 666, 481)

  if (placement) {
    const hq = state.buildings.find((building) => building.kind === "hq" && building.team === "crew")
    if (hq) {
      ctx.strokeStyle = "#19798688"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.arc(hq.x, hq.y, 260, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  for (const resource of state.resources) {
    if (resource.amount <= 0) continue
    ctx.fillStyle = "#615e4944"
    ctx.beginPath()
    ctx.ellipse(resource.x + 3, resource.y + 8, 29, 16, 0, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 5; i++) {
      const x = resource.x - 20 + (i % 3) * 13,
        y = resource.y - 15 + Math.floor(i / 3) * 13
      ctx.fillStyle = ["#997b5d", "#5d7b7a", "#af724d"][i % 3]
      ctx.fillRect(x, y, 16, 13)
      ctx.strokeStyle = "#ddc9a4"
      ctx.strokeRect(x + 1, y + 1, 14, 11)
    }
    ctx.font = "bold 11px 'Trebuchet MS', sans-serif"
    ctx.fillStyle = palette.ink
    ctx.textAlign = "center"
    ctx.fillText(`SALVAGE ${Math.ceil(resource.amount)}`, resource.x, resource.y + 33)
  }
  ctx.textAlign = "left"
  for (const building of state.buildings) {
    const friendly = building.team === "crew",
      color = friendly ? palette.crew : palette.rival
    const width = building.kind === "hq" ? 60 : building.kind === "workshop" ? 50 : 26
    ctx.fillStyle = "#283b3455"
    ctx.fillRect(building.x - width / 2 + 5, building.y - 17 + 8, width, 40)
    ctx.fillStyle = friendly ? "#28555b" : "#773e32"
    ctx.fillRect(building.x - width / 2, building.y - 17, width, 39)
    ctx.fillStyle = color
    ctx.fillRect(building.x - width / 2, building.y - 24, width, 34)
    ctx.strokeStyle = "#ffffff3a"
    ctx.lineWidth = 1
    for (let x = building.x - width / 2 + 6; x < building.x + width / 2; x += 8) {
      ctx.beginPath()
      ctx.moveTo(x, building.y - 23)
      ctx.lineTo(x, building.y + 9)
      ctx.stroke()
    }
    ctx.fillStyle = "#f1e4bd"
    ctx.fillRect(building.x - 6, building.y - 14, 12, 9)
    if (building.kind === "sentry") {
      ctx.fillStyle = "#273c39"
      ctx.beginPath()
      ctx.arc(building.x, building.y - 10, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(building.x, building.y - 13, 24, 6)
    }
    ctx.fillStyle = "#233a38"
    ctx.fillRect(building.x - width / 2, building.y + 28, width, 4)
    ctx.fillStyle = friendly ? "#427747" : "#b44836"
    ctx.fillRect(
      building.x - width / 2,
      building.y + 28,
      width * Math.max(0, building.hp / building.maxHp),
      4,
    )
    ctx.font = "bold 11px 'Trebuchet MS', sans-serif"
    ctx.fillStyle = palette.ink
    ctx.textAlign = "center"
    ctx.fillText(
      building.kind === "hq"
        ? friendly
          ? "YOUR HQ"
          : "RIVAL HQ"
        : building.kind === "workshop"
          ? "WORKSHOP"
          : "SENTRY",
      building.x,
      building.y + 47,
    )
  }
  for (const unit of state.units) {
    const isSelected = selected.includes(unit.id)
    if (isSelected) {
      ctx.strokeStyle = "#edf5d4"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(unit.x, unit.y + 3, 13, 8, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = "#253e3855"
    ctx.beginPath()
    ctx.ellipse(unit.x + 3, unit.y + 6, 8, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = unit.team === "rival" ? palette.rival : unit.kind === "guard" ? palette.crew : "#59574b"
    ctx.fillRect(unit.x - 5, unit.y - 3, 10, 11)
    ctx.fillStyle = unit.kind === "worker" ? palette.gold : unit.team === "crew" ? "#204d5b" : "#774034"
    ctx.beginPath()
    ctx.arc(unit.x, unit.y - 6, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#e7c799"
    ctx.fillRect(unit.x - 3, unit.y - 5, 6, 3)
    if (unit.kind !== "worker") {
      ctx.fillStyle = "#243c39"
      ctx.fillRect(unit.x + 4, unit.y - 3, 8, 3)
    }
    if (unit.carried > 0) {
      ctx.fillStyle = palette.gold
      ctx.fillRect(unit.x + 5, unit.y, 6, 6)
    }
    if (unit.hp < unit.maxHp || isSelected) {
      ctx.fillStyle = "#243b3b"
      ctx.fillRect(unit.x - 9, unit.y - 18, 18, 3)
      ctx.fillStyle = unit.team === "crew" ? "#74a66a" : "#cd6b50"
      ctx.fillRect(unit.x - 9, unit.y - 18, (18 * unit.hp) / unit.maxHp, 3)
    }
    if (isSelected && unit.target && unit.resourceId === null) {
      ctx.strokeStyle = "#19798644"
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(unit.x, unit.y)
      ctx.lineTo(unit.target.x, unit.target.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  for (const effect of state.effects) {
    if (effect.end) {
      ctx.strokeStyle = effect.team === "crew" ? "#f5dc78" : "#f09970"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y - 5)
      ctx.lineTo(effect.end.x, effect.end.y - 4)
      ctx.stroke()
    } else if (effect.text) {
      ctx.font = "bold 13px 'Trebuchet MS', sans-serif"
      ctx.fillStyle = "#2f693d"
      ctx.fillText(effect.text, effect.x, effect.y - 23 - (1.2 - effect.life) * 16)
    }
  }
  if (placement && pointer) {
    ctx.globalAlpha = 0.6
    ctx.fillStyle = palette.crew
    ctx.fillRect(pointer.x - 22, pointer.y - 20, 44, 40)
    ctx.globalAlpha = 1
  }
  ctx.textAlign = "left"
}

export default function DockyardGame() {
  const stateRef = useRef(createDockyard())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<number[]>([])
  const placementRef = useRef<"workshop" | "sentry" | null>(null)
  const pointerRef = useRef<DockyardPoint | null>(null)
  const [hud, setHud] = useState({
    scrap: 110,
    workers: 3,
    guards: 1,
    hp: 650,
    wave: 0,
    nextWave: 45,
    time: 0,
    phase: "briefing" as DockyardState["phase"],
    message: stateRef.current.message,
    selected: 0,
    workshop: false,
  })
  const [placement, setPlacement] = useState<"workshop" | "sentry" | null>(null)

  const refreshHud = () => {
    const state = stateRef.current
    selectedRef.current = selectedRef.current.filter((id) => state.units.some((unit) => unit.id === id))
    setHud({
      scrap: Math.floor(state.scrap),
      workers: state.units.filter((unit) => unit.kind === "worker").length,
      guards: state.units.filter((unit) => unit.kind === "guard").length,
      hp: Math.max(
        0,
        Math.ceil(
          state.buildings.find((building) => building.team === "crew" && building.kind === "hq")?.hp || 0,
        ),
      ),
      wave: state.wave,
      nextWave: Math.max(0, Math.ceil(state.nextWave - state.time)),
      time: state.time,
      phase: state.phase,
      message: state.message,
      selected: selectedRef.current.length,
      workshop: state.buildings.some((building) => building.team === "crew" && building.kind === "workshop"),
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current,
      viewport = viewportRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !viewport || !ctx) return
    let scale = 1,
      offsetX = 0,
      offsetY = 0,
      width = 1,
      height = 1,
      frame = 0,
      previous = 0,
      lastHud = 0
    const resize = () => {
      width = viewport.clientWidth
      height = viewport.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      scale = Math.min(width / DOCKYARD_WIDTH, height / DOCKYARD_HEIGHT)
      offsetX = (width - DOCKYARD_WIDTH * scale) / 2
      offsetY = (height - DOCKYARD_HEIGHT * scale) / 2
    }
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    resize()
    const animate = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0
      previous = now
      tickDockyard(stateRef.current, dt)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = palette.sea
      ctx.fillRect(0, 0, width, height)
      ctx.translate(offsetX, offsetY)
      ctx.scale(scale, scale)
      drawDockyard(ctx, stateRef.current, selectedRef.current, placementRef.current, pointerRef.current)
      if (now - lastHud > 150) {
        refreshHud()
        lastHud = now
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    const onVisibility = () => {
      if (document.hidden && stateRef.current.phase === "playing") {
        stateRef.current.phase = "paused"
        refreshHud()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const selectCrew = (kind: "worker" | "guard") => {
    selectedRef.current = stateRef.current.units.filter((unit) => unit.kind === kind).map((unit) => unit.id)
    placementRef.current = null
    setPlacement(null)
    stateRef.current.message =
      kind === "worker"
        ? "Workers selected. Tap a salvage pile or Gather to begin."
        : "Guards selected. Tap a position to defend, or attack the rival HQ."
    refreshHud()
  }
  const gather = () => {
    const state = stateRef.current
    const ids = state.units.filter((unit) => unit.kind === "worker").map((unit) => unit.id)
    selectedRef.current = ids
    const resource = state.resources
      .filter((item) => item.amount > 0)
      .sort((a, b) => Math.hypot(a.x - 125, a.y - 335) - Math.hypot(b.x - 125, b.y - 335))[0]
    if (resource) orderDockyard(state, ids, resource, resource.id)
    else state.message = "All salvage collected. Use your crew to finish the rival HQ."
    refreshHud()
  }
  const assault = () => {
    const state = stateRef.current
    const guards = state.units.filter((unit) => unit.kind === "guard")
    const hq = state.buildings.find((building) => building.kind === "hq" && building.team === "rival")
    selectedRef.current = guards.map((unit) => unit.id)
    if (hq) orderDockyard(state, selectedRef.current, hq)
    refreshHud()
  }
  const setBuildMode = (kind: "workshop" | "sentry") => {
    placementRef.current = kind
    setPlacement(kind)
    stateRef.current.message = `Tap inside the supply radius to place a ${kind}. Escape cancels.`
    refreshHud()
  }
  const train = (kind: "worker" | "guard") => {
    trainDockyard(stateRef.current, kind)
    refreshHud()
  }
  const pause = () => {
    const state = stateRef.current
    if (state.phase === "playing") state.phase = "paused"
    else if (state.phase === "paused") state.phase = "playing"
    refreshHud()
  }
  const restart = () => {
    stateRef.current = createDockyard()
    stateRef.current.phase = "playing"
    selectedRef.current = []
    placementRef.current = null
    setPlacement(null)
    refreshHud()
    rootRef.current?.focus()
  }

  const mapPoint = (event: PointerEvent<HTMLCanvasElement>): DockyardPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = Math.min(rect.width / DOCKYARD_WIDTH, rect.height / DOCKYARD_HEIGHT)
    return {
      x: (event.clientX - rect.left - (rect.width - DOCKYARD_WIDTH * scale) / 2) / scale,
      y: (event.clientY - rect.top - (rect.height - DOCKYARD_HEIGHT * scale) / 2) / scale,
    }
  }
  const handleMap = (event: PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.phase !== "playing") return
    event.preventDefault()
    rootRef.current?.focus({ preventScroll: true })
    const point = mapPoint(event),
      state = stateRef.current
    if (point.x < 0 || point.x > DOCKYARD_WIDTH || point.y < 0 || point.y > DOCKYARD_HEIGHT) return
    if (placementRef.current) {
      if (buildDockyard(state, placementRef.current, point)) {
        placementRef.current = null
        setPlacement(null)
      }
      refreshHud()
      return
    }
    const clicked = state.units
      .filter((unit) => unit.team === "crew")
      .find((unit) => Math.hypot(unit.x - point.x, unit.y - point.y) < 20)
    if (clicked) {
      selectedRef.current = event.shiftKey
        ? Array.from(new Set([...selectedRef.current, clicked.id]))
        : [clicked.id]
      state.message =
        clicked.kind === "worker"
          ? "Worker selected. Tap salvage to gather, or a position to move."
          : "Guard selected. Tap a position to defend or advance."
    } else {
      const resource = state.resources.find(
        (item) => item.amount > 0 && Math.hypot(item.x - point.x, item.y - point.y) < 40,
      )
      if (selectedRef.current.length) orderDockyard(state, selectedRef.current, point, resource?.id)
      else state.message = "Select a worker or guard first. The crew buttons select a whole group."
    }
    refreshHud()
  }
  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const key = event.key.toLowerCase()
    if (key === "escape") {
      event.stopPropagation()
      if (placementRef.current) {
        placementRef.current = null
        setPlacement(null)
        stateRef.current.message = "Build cancelled."
        refreshHud()
      } else pause()
    } else if (key === " " && !(event.target instanceof HTMLButtonElement)) pause()
    else if (key === "w") selectCrew("worker")
    else if (key === "f") selectCrew("guard")
    else if (key === "g") gather()
    else if (key === "a") assault()
    else return
    event.preventDefault()
  }
  const actionStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 36,
    padding: "6px 9px",
    border: "1px solid #b2b39e",
    borderRadius: 3,
    background: palette.paper,
    color: palette.ink,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    flex: "1 1 110px",
  }
  const playing = hud.phase === "playing"

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeys}
      aria-label="Dockyard strategy game"
      className={focusClass}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "auto",
        background: palette.sea,
        color: palette.paper,
        fontFamily: '"Trebuchet MS", sans-serif',
        outlineOffset: -2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          padding: "9px 12px",
          borderBottom: "2px solid #a99558",
          background: "#16373e",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <strong style={{ fontSize: 21, letterSpacing: -1 }}>Dockyard</strong>
          <span style={{ fontSize: 11, color: "#c3cbb8" }}>Take back the waterfront.</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span aria-label="Salvage available">
            <strong style={{ color: "#edcf78" }}>{hud.scrap}</strong> salvage
          </span>
          <span>HQ {hud.hp}</span>
          <span>{clock(hud.time)}</span>
          <button
            className={focusClass}
            aria-label={hud.phase === "paused" ? "Resume Dockyard" : "Pause Dockyard"}
            disabled={hud.phase === "briefing" || hud.phase === "won" || hud.phase === "lost"}
            onClick={pause}
            style={{
              border: "1px solid #6c8077",
              borderRadius: 3,
              padding: 5,
              background: "transparent",
              color: palette.paper,
              cursor: "pointer",
            }}
          >
            {hud.phase === "paused" ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        style={{ position: "relative", flex: "1 0 250px", minHeight: 250, overflow: "hidden" }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Waterfront map. Select crew, then click salvage to gather or ground to move. Use crew command buttons on touch screens."
          onPointerDown={handleMap}
          onPointerMove={(event) => {
            pointerRef.current = mapPoint(event)
          }}
          onPointerLeave={() => {
            pointerRef.current = null
          }}
          onContextMenu={(event) => event.preventDefault()}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
            cursor: placement ? "crosshair" : "default",
            touchAction: "none",
          }}
        />
        {hud.phase !== "playing" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              background: "#102d34a8",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                maxWidth: 405,
                maxHeight: "100%",
                overflowY: "auto",
                padding: "22px 24px",
                background: palette.paper,
                color: palette.ink,
                border: "3px solid #c6b277",
                boxShadow: "6px 8px 0 #0b273a77",
              }}
            >
              <h2 style={{ fontSize: 32, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1 }}>
                {hud.phase === "briefing"
                  ? "Your dock. Your crew."
                  : hud.phase === "paused"
                    ? "Crew on break."
                    : hud.phase === "won"
                      ? "Waterfront secured."
                      : "The dock went under."}
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 12 }}>
                {hud.phase === "briefing"
                  ? "Gather salvage, build a workshop, and train guards. Protect your HQ from rival waves, then take down their red HQ across the pier."
                  : hud.phase === "paused"
                    ? "The simulation is paused. Your crew and the rivals will wait."
                    : hud.phase === "won"
                      ? `You reclaimed the pier in ${clock(hud.time)}${hud.wave ? ` after ${hud.wave} rival waves.` : ", before the first rival wave arrived."}`
                      : "Keep workers gathering and build sentries near home before sending your guards across the pier."}
              </p>
              {hud.phase === "briefing" && (
                <p style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5 }}>
                  Tap crew to select; tap the map to give orders. W selects workers, F selects guards, G
                  gathers. Space pauses. Crew buttons work on touch screens.
                </p>
              )}
              <button
                className={focusClass}
                onClick={hud.phase === "paused" ? pause : restart}
                style={{
                  ...actionStyle,
                  width: "100%",
                  marginTop: 15,
                  minHeight: 42,
                  background: palette.crew,
                  color: "white",
                  borderColor: "#14505c",
                  fontSize: 13,
                }}
              >
                {hud.phase === "paused" ? <Play size={15} /> : <Flag size={15} />}
                {hud.phase === "briefing"
                  ? "Open the dock"
                  : hud.phase === "paused"
                    ? "Back to work"
                    : "Run the dock again"}
              </button>
              {hud.phase === "paused" && (
                <button
                  className={focusClass}
                  onClick={restart}
                  style={{ ...actionStyle, width: "100%", marginTop: 7 }}
                >
                  <RotateCcw size={12} />
                  Restart this run
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          padding: "8px 10px",
          background: "#e1dac1",
          color: palette.ink,
          borderTop: "2px solid #a99558",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 5,
            fontSize: 11,
            marginBottom: 7,
          }}
        >
          <span>
            {hud.selected ? `${hud.selected} crew selected` : "Select a crew group"}
            {placement ? ` · Place ${placement}` : ""}
          </span>
          <span>
            Wave {hud.wave + 1} in {hud.nextWave}s
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <button
            disabled={!playing}
            className={`${focusClass} disabled:opacity-40`}
            onClick={() => selectCrew("worker")}
            style={actionStyle}
          >
            <HardHat size={14} />
            Workers ({hud.workers})
          </button>
          <button
            disabled={!playing}
            className={`${focusClass} disabled:opacity-40`}
            onClick={gather}
            style={actionStyle}
          >
            <Hammer size={14} />
            Gather salvage
          </button>
          <button
            disabled={!playing}
            className={`${focusClass} disabled:opacity-40`}
            onClick={() => selectCrew("guard")}
            style={actionStyle}
          >
            <Shield size={14} />
            Guards ({hud.guards})
          </button>
          <button
            disabled={!playing || hud.guards === 0}
            className={`${focusClass} disabled:opacity-40`}
            onClick={assault}
            style={actionStyle}
          >
            <Flag size={14} />
            Attack rival HQ
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
          <button
            disabled={!playing || hud.scrap < DOCKYARD_COSTS.worker}
            className={`${focusClass} disabled:opacity-40`}
            onClick={() => train("worker")}
            style={actionStyle}
          >
            Worker · {DOCKYARD_COSTS.worker}
          </button>
          <button
            disabled={!playing || hud.scrap < DOCKYARD_COSTS.workshop}
            className={`${focusClass} disabled:opacity-40`}
            onClick={() => setBuildMode("workshop")}
            style={{ ...actionStyle, background: placement === "workshop" ? "#c7d3ba" : palette.paper }}
          >
            <Warehouse size={14} />
            Workshop · {DOCKYARD_COSTS.workshop}
          </button>
          <button
            disabled={!playing || hud.scrap < DOCKYARD_COSTS.sentry}
            className={`${focusClass} disabled:opacity-40`}
            onClick={() => setBuildMode("sentry")}
            style={{ ...actionStyle, background: placement === "sentry" ? "#c7d3ba" : palette.paper }}
          >
            Sentry · {DOCKYARD_COSTS.sentry}
          </button>
          <button
            disabled={!playing || !hud.workshop || hud.scrap < DOCKYARD_COSTS.guard}
            className={`${focusClass} disabled:opacity-40`}
            onClick={() => train("guard")}
            style={actionStyle}
          >
            Guard · {DOCKYARD_COSTS.guard}
          </button>
        </div>
        <p role="status" style={{ marginTop: 7, fontSize: 11, lineHeight: 1.35, minHeight: 15 }}>
          {hud.message}
        </p>
      </div>
    </div>
  )
}
