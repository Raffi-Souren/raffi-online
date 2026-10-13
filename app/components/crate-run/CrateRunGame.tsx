"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { ArrowUp, ChevronLeft, ChevronRight, Disc3, Pause, Play } from "lucide-react"
import { useWindowActivity } from "../../../components/ui/WindowShell"
import GameJoystick from "../../../components/ui/GameJoystick"
import GameControlChoice, { useGameControlMode } from "../../../components/ui/GameControlChoice"
import {
  VIEW_H,
  VIEW_W,
  createCrateRun,
  startCrateRun,
  stepCrateRun,
  type CrateRunInput,
} from "@/lib/crate-run-engine"
import { PALETTE, drawCrateRun } from "./draw"

type Control = keyof CrateRunInput

interface CrateRunGameProps {
  onCleared: (records: number) => void
  onSkip: () => void
}

const STEP = 1 / 60
const RENDER_SCALE = 2
/** Narrow portrait screens zoom the camera in so the player stays at least 24 CSS px tall. */
const PHONE_VIEW_W = 192
const PHONE_BREAKPOINT = 420
const KEY_CONTROLS: Record<string, Control> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  KeyZ: "jump",
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

export default function CrateRunGame({ onCleared, onSkip }: CrateRunGameProps) {
  const { active, minimized } = useWindowActivity()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [fieldSize, setFieldSize] = useState({ width: 256, height: 160 })
  const [viewW, setViewW] = useState(VIEW_W)
  const stateRef = useRef(createCrateRun())
  const keysRef = useRef<CrateRunInput>({ left: false, right: false, jump: false })
  const touchesRef = useRef(new Map<number, Control>())
  const jumpPendingRef = useRef(false)
  const stickRef = useRef(0)
  const [controlMode, setControlMode] = useGameControlMode("brooklyn-dig")
  const [paused, setPaused] = useState(false)
  const [compact, setCompact] = useState(false)
  const runningRef = useRef(active && !minimized)
  const clearedRef = useRef(onCleared)
  const [hud, setHud] = useState({ phase: stateRef.current.phase, records: 0, total: stateRef.current.totalRecords, seconds: 0 })
  const [pressed, setPressed] = useState<Record<Control, boolean>>({ left: false, right: false, jump: false })

  useEffect(() => {
    clearedRef.current = onCleared
  }, [onCleared])

  useEffect(() => {
    const query = window.matchMedia("(max-height: 520px) and (min-width: 600px)")
    const sync = () => setCompact(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const resize = () => {
      const nextViewW = field.clientWidth < PHONE_BREAKPOINT ? PHONE_VIEW_W : VIEW_W
      stateRef.current.viewW = nextViewW
      setViewW(nextViewW)
      const width = Math.min(field.clientWidth, field.clientHeight * nextViewW / VIEW_H)
      setFieldSize({ width, height: width * VIEW_H / nextViewW })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(field)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    runningRef.current = active && !minimized && !paused
    if (!runningRef.current) {
      keysRef.current = { left: false, right: false, jump: false }
      touchesRef.current.clear()
      jumpPendingRef.current = false
      stickRef.current = 0
      setPressed({ left: false, right: false, jump: false })
    }
  }, [active, minimized, paused])

  useEffect(() => {
    const blur = () => {
      keysRef.current = { left: false, right: false, jump: false }
      touchesRef.current.clear()
      jumpPendingRef.current = false
      stickRef.current = 0
      setPressed({ left: false, right: false, jump: false })
      setPaused(true)
    }
    const hidden = () => { if (document.hidden) blur() }
    window.addEventListener("blur", blur)
    document.addEventListener("visibilitychange", hidden)
    return () => {
      window.removeEventListener("blur", blur)
      document.removeEventListener("visibilitychange", hidden)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    let frame = 0
    let previous = 0
    let accumulator = 0
    let clearTimer: ReturnType<typeof setTimeout> | null = null

    const input = (): CrateRunInput => {
      const touch = { left: false, right: false, jump: false }
      touchesRef.current.forEach((control) => (touch[control] = true))
      // A quick tap can finish between simulation steps; retain its rising edge.
      const jump = jumpPendingRef.current || keysRef.current.jump || touch.jump
      jumpPendingRef.current = false
      return {
        left: keysRef.current.left || touch.left || stickRef.current < -0.12,
        right: keysRef.current.right || touch.right || stickRef.current > 0.12,
        jump,
      }
    }

    const loop = (now: number) => {
      const state = stateRef.current
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0
      previous = now
      if (runningRef.current && !document.hidden) {
        accumulator += dt
        let steps = 0
        while (accumulator >= STEP && steps < 6) {
          const controls = input()
          if (state.phase === "ready" && (controls.left || controls.right || controls.jump)) startCrateRun(state)
          stepCrateRun(state, controls, STEP)
          accumulator -= STEP
          steps++
        }
        if (steps === 6) accumulator = 0
      } else {
        accumulator = 0
      }

      // Resizing the canvas resets its context, so reapply the pixel transform every frame.
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0)
      ctx.imageSmoothingEnabled = false
      drawCrateRun(ctx, state, state.viewW)

      setHud((current) => {
        const seconds = Math.floor(state.elapsed)
        if (current.phase === state.phase && current.records === state.records && current.seconds === seconds) return current
        return { phase: state.phase, records: state.records, total: state.totalRecords, seconds }
      })

      if (state.phase === "cleared" && !clearTimer) {
        clearTimer = setTimeout(() => clearedRef.current(state.records), 1100)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      if (clearTimer) clearTimeout(clearTimer)
    }
  }, [])

  useEffect(() => {
    if (!active || minimized) return
    const handle = (event: KeyboardEvent, down: boolean) => {
      // Keys can target window or document, which have no closest().
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return
      if (["KeyP", "Escape"].includes(event.code)) {
        event.preventDefault()
        if (down && !event.repeat) setPaused((value) => !value)
        return
      }
      const control = KEY_CONTROLS[event.code]
      if (!control) return
      // Let Space/arrows activate a focused button rather than steal it.
      if (target?.tagName === "BUTTON" && (event.code === "Space" || event.code === "Enter")) return
      if (paused && down) return
      event.preventDefault()
      if (control === "jump" && down && !event.repeat) jumpPendingRef.current = true
      keysRef.current = { ...keysRef.current, [control]: down }
    }
    const onDown = (event: KeyboardEvent) => handle(event, true)
    const onUp = (event: KeyboardEvent) => handle(event, false)
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    return () => {
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
      keysRef.current = { left: false, right: false, jump: false }
      jumpPendingRef.current = false
    }
  }, [active, minimized, paused])

  const syncPressed = () => {
    const next = { left: false, right: false, jump: false }
    touchesRef.current.forEach((control) => (next[control] = true))
    setPressed(next)
  }

  const press = (control: Control) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!runningRef.current) return
    touchesRef.current.set(event.pointerId, control)
    if (control === "jump") jumpPendingRef.current = true
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture can fail on a pointer that already lifted; the control still registers.
    }
    syncPressed()
  }

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const control = touchesRef.current.get(event.pointerId)
    if (!touchesRef.current.delete(event.pointerId)) return
    if (control === "jump" && event.type !== "pointerup") jumpPendingRef.current = false
    syncPressed()
  }

  const start = () => startCrateRun(stateRef.current)

  const controlButton = (control: Control, label: string, icon: ReactNode, width: number) => (
    <button
      type="button"
      disabled={!active || minimized || paused || hud.phase === "cleared"}
      aria-label={label}
      onPointerDown={press(control)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(event) => {
        if (event.code !== "Space" && event.code !== "Enter") return
        event.preventDefault()
        event.stopPropagation()
        if (!runningRef.current) return
        if (control === "jump" && !event.repeat) jumpPendingRef.current = true
        keysRef.current = { ...keysRef.current, [control]: true }
      }}
      onKeyUp={(event) => {
        if (event.code !== "Space" && event.code !== "Enter") return
        event.preventDefault()
        event.stopPropagation()
        keysRef.current = { ...keysRef.current, [control]: false }
      }}
      onBlur={() => { keysRef.current = { ...keysRef.current, [control]: false } }}
      onClick={(event) => {
        if (control === "jump" && event.detail === 0 && runningRef.current) jumpPendingRef.current = true
      }}
      onContextMenu={(event) => event.preventDefault()}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width,
        height: 56,
        border: `2px solid ${PALETTE.ink}`,
        borderRadius: control === "jump" ? 28 : 10,
        background: pressed[control] ? PALETTE.amber : control === "jump" ? PALETTE.brick : PALETTE.navy,
        color: pressed[control] ? PALETTE.ink : PALETTE.cream,
        boxShadow: pressed[control] ? "none" : `0 4px 0 ${PALETTE.ink}`,
        transform: pressed[control] ? "translateY(4px)" : "none",
        touchAction: "none",
        cursor: "pointer",
        outlineColor: PALETTE.amber,
      }}
    >
      {icon}
    </button>
  )

  return (
    <div data-game="brooklyn-dig" data-phase={paused ? "paused" : hud.phase} className="game-touch" style={{ display: "grid", height: compact ? "100%" : undefined, minHeight: 0, gridTemplateColumns: compact ? "minmax(0, 1fr) 190px" : "minmax(0, 1fr)", gridTemplateRows: compact ? "44px minmax(0, 1fr)" : "44px auto auto", gap: 10, background: PALETTE.ink, padding: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          color: PALETTE.cream,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          letterSpacing: "0.04em",
          gridColumn: compact ? "1 / -1" : undefined,
        }}
      >
        <span>
          WORLD <strong style={{ color: PALETTE.amber }}>1-1</strong>
        </span>
        <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Disc3 size={15} aria-hidden="true" style={{ color: PALETTE.amber }} />
          <span className="sr-only">Records found:</span>
          {hud.records}/{hud.total}
        </span>
        <span>
          <span className="sr-only">Time:</span>
          {formatTime(hud.seconds)}
        </span>
        <button type="button" aria-label={paused ? "Resume Downtown Dig" : "Pause Downtown Dig"} onClick={() => setPaused(!paused)} style={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center", color: PALETTE.cream, background: PALETTE.navy, borderRadius: 6 }}>
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>

      <div ref={fieldRef} style={{ minWidth: 0, minHeight: 0, aspectRatio: compact ? undefined : `${viewW} / ${VIEW_H}`, maxHeight: compact ? undefined : "calc(100dvh - 330px)", display: "grid", placeItems: "center" }}>
      <div style={{ position: "relative", width: fieldSize.width, height: fieldSize.height, borderRadius: 6, overflow: "hidden", background: PALETTE.navyDeep, border: `2px solid ${PALETTE.navy}` }}>
        <canvas
          ref={canvasRef}
          width={viewW * RENDER_SCALE}
          height={VIEW_H * RENDER_SCALE}
          role="img"
          aria-label="Downtown Dig: a side-scrolling street level ending at Raf's Records"
          onPointerDown={start}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", touchAction: "none" }}
        />

        {(hud.phase === "ready" || paused) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "safe center",
              gap: 8,
              padding: 12,
              background: "rgba(18, 24, 38, 0.72)",
              color: PALETTE.cream,
              textAlign: "center",
              overflowY: "auto",
            }}
          >
            <p style={{ margin: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: "0.2em", color: PALETTE.amber }}>
              {paused ? "TAKE A BREATHER" : "SECRET LEVEL UNLOCKED"}
            </p>
            <h2 className="text-balance" style={{ margin: 0, fontSize: 22, lineHeight: 1.1, fontWeight: 800 }}>
              Downtown Dig
            </h2>
            <p className="text-pretty" style={{ margin: 0, maxWidth: 260, fontSize: 13, lineHeight: 1.45 }}>
              Run to Raf&apos;s Records. Every record you grab makes the crate deeper.
            </p>
            <GameControlChoice value={controlMode} onChange={(mode) => { touchesRef.current.clear(); jumpPendingRef.current = false; stickRef.current = 0; syncPressed(); setControlMode(mode) }} />
            <button
              type="button"
              onClick={() => { setPaused(false); start() }}
              className="hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                minHeight: 44,
                padding: "0 22px",
                marginTop: 2,
                border: 0,
                borderRadius: 8,
                background: PALETTE.amber,
                color: PALETTE.ink,
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
                outlineColor: PALETTE.cream,
              }}
            >
              {paused ? "Resume" : "Start"}
            </button>
          </div>
        )}

        {hud.phase === "cleared" && (
          <div
            role="status"
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              transform: "translate(-50%, -50%)",
              padding: "8px 14px",
              borderRadius: 6,
              border: `2px solid ${PALETTE.ink}`,
              background: PALETTE.amber,
              color: PALETTE.ink,
              fontFamily: "ui-monospace, Menlo, monospace",
              fontWeight: 800,
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            CRATE FOUND
          </div>
        )}
      </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 0, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {controlMode === "stick" ? (
          <GameJoystick label="Downtown Dig run stick" axis="horizontal" size={96} disabled={!active || minimized || paused || hud.phase === "cleared"} onChange={({ x }) => { stickRef.current = x }} />
        ) : <div style={{ display: "flex", gap: 10 }}>
          {controlButton("left", "Move left", <ChevronLeft size={28} aria-hidden="true" />, 60)}
          {controlButton("right", "Move right", <ChevronRight size={28} aria-hidden="true" />, 60)}
        </div>}
        {controlButton("jump", "Jump", <ArrowUp size={28} aria-hidden="true" />, 76)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: PALETTE.cream, opacity: 0.75 }}>
          {compact ? "Run + Jump. P to pause." : `${controlMode === "stick" ? "Stick" : "Arrows"} to run; hold Jump for a higher leap. Keyboard: A D / Space. Pause to change controls.`}
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="hover:underline focus-visible:outline focus-visible:outline-2"
          style={{ minHeight: 44, padding: "0 4px", border: 0, background: "transparent", color: PALETTE.amber, fontSize: 13, cursor: "pointer", outlineColor: PALETTE.amber }}
        >
          Skip to the crate
        </button>
      </div>
      </div>
    </div>
  )
}
