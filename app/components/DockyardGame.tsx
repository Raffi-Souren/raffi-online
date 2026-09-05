"use client"

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react"
import { Flag, Hammer, HardHat, Pause, Play, RotateCcw, Shield, Warehouse } from "lucide-react"
import ScoreEntry from "./ScoreEntry"
import {
  buildDockyard,
  createDockyard,
  dockyardBuildIssue,
  DOCKYARD_MISSIONS,
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
  const water = ctx.createLinearGradient(0, 0, 840, 500)
  water.addColorStop(0, "#316873")
  water.addColorStop(0.5, "#204850")
  water.addColorStop(1, "#071f35")
  ctx.fillStyle = water
  ctx.fillRect(0, 0, DOCKYARD_WIDTH, DOCKYARD_HEIGHT)
  ctx.lineWidth = 1
  ctx.strokeStyle = "#a3c7be30"
  for (let y = 12; y < 500; y += 12) {
    ctx.beginPath()
    for (let x = 0; x <= 840; x += 10) {
      const wave = Math.sin(x / 46 + y + state.time * 0.65) * 2.5
      if (x === 0) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.stroke()
  }
  ctx.fillStyle = "#092a3590"
  ctx.fillRect(46, 64, 760, 391)
  ctx.fillStyle = "#656e60"
  ctx.fillRect(38, 48, 760, 403)
  const concrete = ctx.createLinearGradient(38, 48, 740, 443)
  concrete.addColorStop(0, "#b7b39c")
  concrete.addColorStop(1, "#737f77")
  ctx.fillStyle = concrete
  ctx.fillRect(38, 48, 760, 395)
  ctx.fillStyle = "#f0e3be"
  ctx.fillRect(38, 48, 760, 3)
  ctx.fillStyle = "#ebe0b7"
  ctx.fillRect(38, 438, 760, 4)
  for (let x = 77; x < 760; x += 133) {
    ctx.fillStyle = "#0f303b88"
    ctx.fillRect(x + 5, 447, 63, 31)
    ctx.fillStyle = "#796f53"
    ctx.fillRect(x, 443, 63, 31)
    for (let plank = 0; plank < 5; plank++) {
      ctx.fillStyle = plank % 2 ? "#a0926c" : "#b7a780"
      ctx.fillRect(x + 2, 445 + plank * 5, 59, 4)
    }
    ctx.fillStyle = "#243d3c"
    ctx.fillRect(x + 6, 447, 5, 7)
    ctx.fillRect(x + 51, 464, 5, 7)
  }
  for (let x = 57; x < 798; x += 64) {
    ctx.fillStyle = "#414a41"
    ctx.fillRect(x, 431, 12, 6)
    ctx.fillStyle = "#f5df8b"
    ctx.fillRect(x + 2, 430, 8, 2)
  }
  // Staggered granite blocks, worn edges and wet patches form a readable ground plane.
  for (let row = 0; row < 25; row++)
    for (let col = 0; col < 40; col++) {
      const x = 39 + col * 19 + (row % 2) * 9,
        y = 50 + row * 15
      if (x + 17 > 797 || y + 13 > 437) continue
      ctx.fillStyle = ["#a3a695", "#b5b39b", "#959f94", "#8e9891"][(row * 7 + col * 3) % 4]
      ctx.fillRect(x, y, 17, 13)
      ctx.fillStyle = "#d2ccb33a"
      ctx.fillRect(x, y, 17, 1)
    }
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = "#244d5c28"
    ctx.beginPath()
    ctx.ellipse(65 + ((i * 139) % 700), 75 + ((i * 71) % 340), 18 + (i % 17), 5, -0.3, 0, Math.PI * 2)
    ctx.fill()
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

  for (const [x, y, color] of [
    [185, 482, "#b15840"],
    [452, 482, "#d2b66f"],
    [718, 482, "#538d99"],
  ] as const) {
    const bob = Math.sin(state.time * 1.3 + x) * 1.3
    ctx.save()
    ctx.translate(x, y + bob)
    ctx.fillStyle = "#041d2d88"
    ctx.beginPath()
    ctx.ellipse(8, 3, 47, 12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(-38, -9)
    ctx.lineTo(29, -9)
    ctx.lineTo(43, 0)
    ctx.lineTo(29, 9)
    ctx.lineTo(-38, 9)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#192e37"
    ctx.fillRect(-29, -6, 47, 12)
    ctx.fillStyle = "#e7ddbe"
    ctx.fillRect(-10, -10, 19, 13)
    ctx.fillStyle = "#5b929d"
    ctx.fillRect(-8, -8, 15, 5)
    ctx.strokeStyle = "#a6b6a7"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(0, -35)
    ctx.stroke()
    ctx.restore()
  }
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
      ctx.fillStyle = "#514c3c"
      ctx.fillRect(x + 3, y + 4, 17, 14)
      ctx.fillStyle = ["#997b5d", "#5d7b7a", "#af724d"][i % 3]
      ctx.fillRect(x, y, 16, 13)
      ctx.fillStyle = ["#c9ad80", "#8ba39a", "#d9a379"][i % 3]
      ctx.fillRect(x, y - 4, 16, 5)
      ctx.strokeStyle = "#ddc9a499"
      ctx.strokeRect(x + 1, y + 1, 14, 11)
      ctx.fillStyle = "#e0cc9b"
      ctx.fillRect(x + 6, y - 3, 3, 15)
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
    const left = building.x - width / 2
    ctx.fillStyle = "#243b3450"
    ctx.beginPath()
    ctx.moveTo(left, building.y + 17)
    ctx.lineTo(left + width + 24, building.y + 30)
    ctx.lineTo(left + width + 32, building.y + 14)
    ctx.lineTo(left + width, building.y - 21)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = friendly ? "#294e50" : "#713f34"
    ctx.fillRect(left, building.y - 12, width, 34)
    ctx.fillStyle = friendly ? "#173d45" : "#502f2a"
    ctx.beginPath()
    ctx.moveTo(left + width, building.y - 27)
    ctx.lineTo(left + width + 9, building.y - 17)
    ctx.lineTo(left + width + 9, building.y + 22)
    ctx.lineTo(left + width, building.y + 22)
    ctx.fill()
    const roofY = building.y - 38,
      ridgeY = building.y - (building.kind === "sentry" ? 47 : 60)
    ctx.fillStyle = friendly ? "#9b6e52" : "#806154"
    ctx.fillRect(left, roofY, width, 60)
    ctx.strokeStyle = "#d4a07950"
    ctx.lineWidth = 1
    for (let row = 0; row < 7; row++) {
      const y = roofY + row * 8
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(left + width, y)
      ctx.stroke()
      for (let x = left + (row % 2) * 7; x < left + width; x += 14) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + 8)
        ctx.stroke()
      }
    }
    ctx.fillStyle = friendly ? "#73a2a0" : "#ba826b"
    ctx.beginPath()
    ctx.moveTo(left - 5, roofY)
    ctx.lineTo(building.x, ridgeY)
    ctx.lineTo(left + width + 5, roofY)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(left - 5, roofY)
    ctx.lineTo(building.x, ridgeY)
    ctx.lineTo(building.x, ridgeY + 26)
    ctx.lineTo(left - 5, roofY + 25)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = friendly ? "#29494f" : "#6c463f"
    ctx.beginPath()
    ctx.moveTo(building.x, ridgeY)
    ctx.lineTo(left + width + 5, roofY)
    ctx.lineTo(left + width + 5, roofY + 25)
    ctx.lineTo(building.x, ridgeY + 26)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = "#acd0b970"
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const u = i / 6
      ctx.beginPath()
      ctx.moveTo(left - 5 + (width / 2 + 5) * u, roofY + (ridgeY - roofY) * u)
      ctx.lineTo(left - 5 + (width / 2 + 5) * u, roofY + (ridgeY - roofY) * u + 25)
      ctx.stroke()
    }
    const glow = ctx.createRadialGradient(building.x, building.y + 12, 2, building.x, building.y + 12, width)
    glow.addColorStop(0, "#f2c57530")
    glow.addColorStop(1, "#f2c57500")
    ctx.fillStyle = glow
    ctx.fillRect(left - 25, building.y - 10, width + 50, 70)
    // Raised roof vent, lit clerestory and loading door keep each structure legible at map scale.
    ctx.fillStyle = "#344f4e"
    ctx.fillRect(left + 7, building.y - 24, 13, 9)
    ctx.fillStyle = "#99a797"
    ctx.fillRect(left + 7, building.y - 26, 13, 3)
    if (building.kind !== "sentry") {
      ctx.fillStyle = "#172f34"
      ctx.fillRect(building.x - 9, building.y + 4, 18, 18)
      ctx.fillStyle = "#8a9b86"
      for (let y = 5; y < 20; y += 4) ctx.fillRect(building.x - 8, building.y + y, 16, 1)
      ctx.fillStyle = "#efd79b"
      ctx.fillRect(left + 5, building.y + 5, 7, 6)
      ctx.fillRect(left + width - 12, building.y + 5, 7, 6)
      ctx.fillStyle = "#183b40"
      ctx.fillRect(left - 3, building.y + 21, width + 6, 4)
      if (building.kind === "hq") {
        ctx.strokeStyle = "#ede1b7"
        ctx.beginPath()
        ctx.moveTo(building.x + 21, building.y - 25)
        ctx.lineTo(building.x + 21, building.y - 44)
        ctx.stroke()
        ctx.fillStyle = friendly ? "#f3d57c" : "#e78965"
        ctx.fillRect(building.x + 22, building.y - 44, 14, 8)
      }
    } else {
      ctx.fillStyle = "#c7bc92"
      ctx.fillRect(left - 3, building.y + 17, width + 6, 6)
      ctx.fillStyle = "#273c39"
      ctx.beginPath()
      ctx.arc(building.x, building.y - 10, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#819687"
      ctx.fillRect(building.x - 4, building.y - 15, 9, 3)
      ctx.fillStyle = "#273c39"
      ctx.fillRect(building.x, building.y - 13, 24, 6)
    }
    ctx.fillStyle = "#233a38"
    ctx.fillRect(building.x - width / 2, building.y + 28, width, 4)
    ctx.fillStyle = friendly ? "#427747" : "#b44836"
    ctx.fillRect(building.x - width / 2, building.y + 28, width * Math.max(0, building.hp / building.maxHp), 4)
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
    const stride =
      unit.target || unit.resourceId !== null || unit.team === "rival" ? Math.sin(state.time * 12 + unit.id) * 3 : 0
    ctx.fillStyle = "#243639"
    ctx.fillRect(unit.x - 5, unit.y + 5, 4, 7 + stride)
    ctx.fillRect(unit.x + 1, unit.y + 5, 4, 7 - stride)
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
    const destination =
      unit.kind === "worker" &&
      (unit.carried >= 15 || (!state.resources.some((resource) => resource.amount > 0) && unit.carried > 0))
        ? state.buildings.find((building) => building.team === "crew" && building.kind === "hq")
        : state.resources.find((resource) => resource.id === unit.resourceId && resource.amount > 0) || unit.target
    if (isSelected && destination) {
      ctx.strokeStyle = "#195b6090"
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(unit.x, unit.y)
      ctx.lineTo(destination.x, destination.y)
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
    const issue = dockyardBuildIssue(state, placement, pointer)
    ctx.fillStyle = issue ? "#b4483666" : "#19798666"
    ctx.fillRect(pointer.x - 25, pointer.y - 24, 50, 47)
    ctx.strokeStyle = issue ? "#963729" : "#12585c"
    ctx.lineWidth = 2
    ctx.strokeRect(pointer.x - 25, pointer.y - 24, 50, 47)
    ctx.font = "bold 11px 'Trebuchet MS', sans-serif"
    ctx.textAlign = "center"
    const label = issue ? "CANNOT BUILD HERE" : `PLACE ${placement.toUpperCase()} · ${DOCKYARD_COSTS[placement]}`
    const labelX = Math.max(105, Math.min(735, pointer.x))
    const labelY = Math.max(20, pointer.y - 36)
    ctx.fillStyle = "#f3ecd9"
    ctx.fillRect(labelX - 102, labelY - 13, 204, 19)
    ctx.fillStyle = issue ? "#963729" : "#12585c"
    ctx.fillText(label, labelX, labelY)
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
    level: 1,
    scrap: 110,
    workers: 3,
    guards: 1,
    hp: 650,
    rivalHp: 550,
    idleWorkers: 3,
    selectedWorkers: 0,
    selectedGuards: 0,
    orders: "Select workers or guards to give an order.",
    wave: 0,
    nextWave: 45,
    time: 0,
    phase: "briefing" as DockyardState["phase"],
    message: stateRef.current.message,
    selected: 0,
    workshop: false,
  })
  const [placement, setPlacement] = useState<"workshop" | "sentry" | null>(null)
  const [runId, setRunId] = useState(0)

  const refreshHud = () => {
    const state = stateRef.current
    selectedRef.current = selectedRef.current.filter((id) => state.units.some((unit) => unit.id === id))
    const selection = state.units.filter((unit) => selectedRef.current.includes(unit.id))
    const tasks = new Map<string, number>()
    for (const unit of selection) {
      const remainingSalvage = state.resources.some((resource) => resource.amount > 0)
      const task =
        unit.kind === "worker" && (unit.carried >= 15 || (!remainingSalvage && unit.carried > 0))
          ? "delivering"
          : unit.kind === "worker" && unit.resourceId !== null
            ? "salvaging"
            : unit.target
              ? "advancing"
              : unit.kind === "guard"
                ? "defending"
                : "idle"
      tasks.set(task, (tasks.get(task) || 0) + 1)
    }
    setHud({
      level: state.level,
      rivalHp: Math.max(
        0,
        Math.ceil(state.buildings.find((building) => building.team === "rival" && building.kind === "hq")?.hp || 0),
      ),
      idleWorkers: state.units.filter(
        (unit) => unit.kind === "worker" && unit.resourceId === null && !unit.target && unit.carried === 0,
      ).length,
      selectedWorkers: selection.filter((unit) => unit.kind === "worker").length,
      selectedGuards: selection.filter((unit) => unit.kind === "guard").length,
      orders:
        Array.from(tasks, ([task, count]) => `${count} ${task}`).join(" · ") ||
        "Select workers or guards to give an order.",
      scrap: Math.floor(state.scrap),
      workers: state.units.filter((unit) => unit.kind === "worker").length,
      guards: state.units.filter((unit) => unit.kind === "guard").length,
      hp: Math.max(
        0,
        Math.ceil(state.buildings.find((building) => building.team === "crew" && building.kind === "hq")?.hp || 0),
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

  const cancelPlacement = () => {
    placementRef.current = null
    setPlacement(null)
  }
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
    if (state.phase !== "playing") return
    cancelPlacement()
    const ids = state.units.filter((unit) => unit.kind === "worker").map((unit) => unit.id)
    selectedRef.current = ids
    const resource = state.resources
      .filter((item) => item.amount > 0)
      .sort((a, b) => Math.hypot(a.x - 125, a.y - 335) - Math.hypot(b.x - 125, b.y - 335))[0]
    if (!ids.length) state.message = "Train a worker at your HQ to collect salvage."
    else if (resource) orderDockyard(state, ids, resource, resource.id)
    else state.message = "All salvage collected. Use your crew to finish the rival HQ."
    refreshHud()
  }
  const assault = () => {
    const state = stateRef.current
    if (state.phase !== "playing") return
    cancelPlacement()
    const guards = state.units.filter((unit) => unit.kind === "guard")
    const hq = state.buildings.find((building) => building.kind === "hq" && building.team === "rival")
    selectedRef.current = guards.map((unit) => unit.id)
    if (!guards.length) state.message = "Train guards at a workshop before attacking."
    else if (hq) orderDockyard(state, selectedRef.current, hq)
    refreshHud()
  }
  const setBuildMode = (kind: "workshop" | "sentry") => {
    if (placementRef.current === kind) {
      cancelPlacement()
      stateRef.current.message = "Build cancelled. Select crew or give an order."
      refreshHud()
      return
    }
    placementRef.current = kind
    setPlacement(kind)
    stateRef.current.message = `Tap inside the supply radius to place a ${kind}. Escape cancels.`
    refreshHud()
  }
  const train = (kind: "worker" | "guard") => {
    cancelPlacement()
    trainDockyard(stateRef.current, kind)
    refreshHud()
  }
  const pause = () => {
    const state = stateRef.current
    if (state.phase === "playing") state.phase = "paused"
    else if (state.phase === "paused") state.phase = "playing"
    refreshHud()
  }
  const startMission = (level: number) => {
    stateRef.current = createDockyard(level)
    stateRef.current.phase = "playing"
    setRunId((id) => id + 1)
    selectedRef.current = []
    placementRef.current = null
    setPlacement(null)
    refreshHud()
    rootRef.current?.focus()
  }

  const restart = () => startMission(stateRef.current.level)

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
      selectedRef.current = event.shiftKey ? Array.from(new Set([...selectedRef.current, clicked.id])) : [clicked.id]
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
    if (
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable || event.target.closest("input, textarea, select"))
    )
      return
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
    minHeight: 40,
    padding: "6px 9px",
    border: "1px solid #b2b39e",
    borderRadius: 3,
    background: palette.paper,
    color: palette.ink,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    flex: "1 1 110px",
    boxShadow: "0 1px 0 #ffffff8c inset, 0 1px 1px #52615422",
  }
  const playing = hud.phase === "playing"
  const crewFull = hud.workers + hud.guards >= 24
  const nextOrder =
    hud.workers === 0
      ? "Train a worker to restart your salvage supply."
      : hud.idleWorkers > 0
        ? `${hud.idleWorkers} idle ${hud.idleWorkers === 1 ? "worker" : "workers"} — use Gather to keep salvage coming.`
        : !hud.workshop
          ? "Build a workshop near your HQ to unlock guards."
          : hud.guards < 5
            ? "Train a guard squad. Sentries can protect home while you advance."
            : "Your squad is ready. Attack the rival HQ to secure the waterfront."
  const purchaseNote = (kind: keyof typeof DOCKYARD_COSTS) => {
    if ((kind === "worker" || kind === "guard") && crewFull) return "Crew full · 24 / 24"
    if (kind === "guard" && !hud.workshop) return "Requires workshop"
    const missing = DOCKYARD_COSTS[kind] - hud.scrap
    if (missing > 0) return `Need ${missing} more salvage`
    return kind === "worker" || kind === "guard" ? "Ready to train" : "Choose a site"
  }
  const purchaseLabel = (kind: keyof typeof DOCKYARD_COSTS, label: string) => (
    <span style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
      <span>
        {label} <span style={{ color: "#695e35", fontVariantNumeric: "tabular-nums" }}>· {DOCKYARD_COSTS[kind]}</span>
      </span>
      <span style={{ fontSize: 10, fontWeight: 400, color: "#526153" }}>{purchaseNote(kind)}</span>
    </span>
  )

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
          <span style={{ fontSize: 10, color: "#c3cbb8", letterSpacing: 1.5, textTransform: "uppercase" }}>
            North Pier / Operations
          </span>
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
          <span>{hud.workers + hud.guards}/24 crew</span>
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
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 20px",
          alignItems: "center",
          padding: "8px 12px",
          background: "#21454a",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: "1 1 240px", fontSize: 11, lineHeight: 1.4 }}>
          <strong style={{ color: "#f2d889" }}>OBJECTIVE: DESTROY THE RIVAL HQ</strong>
          <div style={{ color: "#d1d9c8", marginTop: 2 }}>{nextOrder}</div>
        </div>
        <div style={{ display: "flex", gap: 14, flex: "0 1 220px" }}>
          {[
            { label: "Your HQ", hp: hud.hp, max: 650, color: "#8bbe91" },
            { label: "Rival HQ", hp: hud.rivalHp, max: DOCKYARD_MISSIONS[hud.level - 1].hp, color: "#ed947a" },
          ].map((base) => (
            <div key={base.label} style={{ flex: 1, minWidth: 88 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, marginBottom: 4 }}>
                <span>{base.label}</span>
                <strong>{base.hp}</strong>
              </div>
              <div
                role="meter"
                aria-label={`${base.label} health`}
                aria-valuemin={0}
                aria-valuemax={base.max}
                aria-valuenow={base.hp}
                style={{ height: 4, background: "#102f34" }}
              >
                <div style={{ height: "100%", width: `${(base.hp / base.max) * 100}%`, background: base.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div ref={viewportRef} style={{ position: "relative", flex: "1 0 250px", minHeight: 250, overflow: "hidden" }}>
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
                  ? "Keep your HQ standing and destroy the red rival HQ across the pier. Salvage pays for every worker, building and guard."
                  : hud.phase === "paused"
                    ? "The simulation is paused. Your crew and the rivals will wait."
                    : hud.phase === "won"
                      ? `You reclaimed the pier in ${clock(hud.time)}${hud.wave ? ` after ${hud.wave} rival waves.` : ", before the first rival wave arrived."}`
                      : "Keep workers gathering and build sentries near home before sending your guards across the pier."}
              </p>
              {hud.phase === "won" && (
                <ScoreEntry
                  key={`dockyard-${runId}`}
                  gameName="dockyard"
                  score={Math.round(hud.time * 1000)}
                  level={hud.level}
                />
              )}
              {(hud.phase === "briefing" || hud.phase === "won") && (
                <div style={{ display: "grid", gap: 6, marginTop: 14 }} aria-label="Dockyard missions">
                  {DOCKYARD_MISSIONS.map((mission, index) => (
                    <button
                      key={mission.name}
                      className={focusClass}
                      onClick={() => startMission(index + 1)}
                      style={{ ...actionStyle, textAlign: "left", padding: 10 }}
                    >
                      <strong>
                        {index + 1}. {mission.name}
                      </strong>
                      <span style={{ display: "block", fontSize: 11, marginTop: 3 }}>{mission.brief}</span>
                    </button>
                  ))}
                </div>
              )}
              {hud.phase === "briefing" && (
                <>
                  <ol style={{ paddingLeft: 18, marginTop: 12, fontSize: 12, lineHeight: 1.8 }}>
                    <li>
                      <strong>Gather</strong> sends workers to collect and return salvage.
                    </li>
                    <li>
                      <strong>Build a workshop</strong> inside your HQ supply radius.
                    </li>
                    <li>
                      <strong>Train guards</strong> and send a squad at the rival HQ.
                    </li>
                  </ol>
                  <p style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5 }}>
                    Tap crew, then tap a destination. W: workers · F: guards · G: gather · A: attack. Space pauses.
                    Every command also has a touch button.
                  </p>
                </>
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
          <div style={{ lineHeight: 1.5 }}>
            <strong>
              {placement
                ? `PLACE ${placement.toUpperCase()}`
                : hud.selected
                  ? `${hud.selectedWorkers ? `${hud.selectedWorkers} ${hud.selectedWorkers === 1 ? "worker" : "workers"}` : ""}${hud.selectedWorkers && hud.selectedGuards ? " + " : ""}${hud.selectedGuards ? `${hud.selectedGuards} ${hud.selectedGuards === 1 ? "guard" : "guards"}` : ""} selected`
                  : "CREW ORDERS"}
            </strong>
            <div style={{ color: "#516051" }}>
              {placement ? "Green = clear site · Red = blocked · Tap the build button again to cancel" : hud.orders}
            </div>
          </div>
          <span style={{ color: hud.nextWave <= 10 ? "#933c2c" : "#526153", fontWeight: 700 }}>
            {hud.level}/3 · {DOCKYARD_MISSIONS[hud.level - 1].name} · Wave {hud.wave + 1} · {hud.nextWave}s
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 5 }}>
          <button
            disabled={!playing}
            className={`${focusClass} disabled:opacity-60`}
            onClick={() => selectCrew("worker")}
            aria-pressed={!placement && hud.selectedWorkers > 0 && hud.selectedGuards === 0}
            style={{
              ...actionStyle,
              background: !placement && hud.selectedWorkers > 0 && hud.selectedGuards === 0 ? "#c1d2bd" : palette.paper,
            }}
          >
            <HardHat size={14} />
            Workers ({hud.workers})
          </button>
          <button
            disabled={!playing || hud.workers === 0}
            className={`${focusClass} disabled:opacity-60`}
            onClick={gather}
            style={actionStyle}
          >
            <Hammer size={14} />
            Gather salvage
          </button>
          <button
            disabled={!playing}
            className={`${focusClass} disabled:opacity-60`}
            onClick={() => selectCrew("guard")}
            aria-pressed={!placement && hud.selectedGuards > 0 && hud.selectedWorkers === 0}
            style={{
              ...actionStyle,
              background: !placement && hud.selectedGuards > 0 && hud.selectedWorkers === 0 ? "#c1d2bd" : palette.paper,
            }}
          >
            <Shield size={14} />
            Guards ({hud.guards})
          </button>
          <button
            disabled={!playing || hud.guards === 0}
            className={`${focusClass} disabled:opacity-60`}
            onClick={assault}
            style={actionStyle}
          >
            <Flag size={14} />
            Attack rival HQ
          </button>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 5, marginTop: 5 }}
        >
          <button
            disabled={!playing || crewFull || hud.scrap < DOCKYARD_COSTS.worker}
            className={`${focusClass} disabled:opacity-60`}
            onClick={() => train("worker")}
            style={actionStyle}
          >
            <HardHat size={15} />
            {purchaseLabel("worker", "Train worker")}
          </button>
          <button
            disabled={!playing || hud.scrap < DOCKYARD_COSTS.workshop}
            className={`${focusClass} disabled:opacity-60`}
            onClick={() => setBuildMode("workshop")}
            aria-pressed={placement === "workshop"}
            style={{ ...actionStyle, background: placement === "workshop" ? "#c7d3ba" : palette.paper }}
          >
            <Warehouse size={14} />
            {purchaseLabel("workshop", "Workshop")}
          </button>
          <button
            disabled={!playing || hud.scrap < DOCKYARD_COSTS.sentry}
            className={`${focusClass} disabled:opacity-60`}
            onClick={() => setBuildMode("sentry")}
            aria-pressed={placement === "sentry"}
            style={{ ...actionStyle, background: placement === "sentry" ? "#c7d3ba" : palette.paper }}
          >
            <Shield size={15} />
            {purchaseLabel("sentry", "Sentry")}
          </button>
          <button
            disabled={!playing || crewFull || !hud.workshop || hud.scrap < DOCKYARD_COSTS.guard}
            className={`${focusClass} disabled:opacity-60`}
            onClick={() => train("guard")}
            style={actionStyle}
          >
            <Shield size={15} />
            {purchaseLabel("guard", "Train guard")}
          </button>
        </div>
        <p role="status" style={{ marginTop: 7, fontSize: 11, lineHeight: 1.35, minHeight: 15 }}>
          {hud.message}
        </p>
      </div>
    </div>
  )
}
