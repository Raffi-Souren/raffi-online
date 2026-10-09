"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { ArrowUp, ChevronLeft, ChevronRight, Disc3 } from "lucide-react"
import { useWindowActivity } from "../../../components/ui/WindowShell"
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
  const stateRef = useRef(createCrateRun())
  const keysRef = useRef<CrateRunInput>({ left: false, right: false, jump: false })
  const touchesRef = useRef(new Map<number, Control>())
  const runningRef = useRef(active && !minimized)
  const clearedRef = useRef(onCleared)
  const [hud, setHud] = useState({ phase: stateRef.current.phase, records: 0, total: stateRef.current.totalRecords, seconds: 0 })
  const [pressed, setPressed] = useState<Record<Control, boolean>>({ left: false, right: false, jump: false })

  useEffect(() => {
    clearedRef.current = onCleared
  }, [onCleared])

  useEffect(() => {
    runningRef.current = active && !minimized
    if (!runningRef.current) {
      keysRef.current = { left: false, right: false, jump: false }
      touchesRef.current.clear()
      setPressed({ left: false, right: false, jump: false })
    }
  }, [active, minimized])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0)
    ctx.imageSmoothingEnabled = false

    let frame = 0
    let previous = 0
    let accumulator = 0
    let clearTimer: ReturnType<typeof setTimeout> | null = null

    const input = (): CrateRunInput => {
      const touch = { left: false, right: false, jump: false }
      touchesRef.current.forEach((control) => (touch[control] = true))
      return {
        left: keysRef.current.left || touch.left,
        right: keysRef.current.right || touch.right,
        jump: keysRef.current.jump || touch.jump,
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

      drawCrateRun(ctx, state)

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
      const control = KEY_CONTROLS[event.code]
      if (!control) return
      // Keys can target window or document, which have no closest().
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return
      // Let Space/arrows activate a focused button rather than steal it.
      if (target?.tagName === "BUTTON" && (event.code === "Space" || event.code === "Enter")) return
      event.preventDefault()
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
    }
  }, [active, minimized])

  const syncPressed = () => {
    const next = { left: false, right: false, jump: false }
    touchesRef.current.forEach((control) => (next[control] = true))
    setPressed(next)
  }

  const press = (control: Control) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    touchesRef.current.set(event.pointerId, control)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture can fail on a pointer that already lifted; the control still registers.
    }
    syncPressed()
  }

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!touchesRef.current.delete(event.pointerId)) return
    syncPressed()
  }

  const start = () => startCrateRun(stateRef.current)

  const controlButton = (control: Control, label: string, icon: ReactNode, width: number) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={press(control)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
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
    <div className="game-touch" style={{ display: "flex", flexDirection: "column", gap: 10, background: PALETTE.ink, padding: 10 }}>
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
      </div>

      <div style={{ position: "relative", width: "100%", aspectRatio: `${VIEW_W} / ${VIEW_H}`, borderRadius: 6, overflow: "hidden", border: `2px solid ${PALETTE.navy}` }}>
        <canvas
          ref={canvasRef}
          width={VIEW_W * RENDER_SCALE}
          height={VIEW_H * RENDER_SCALE}
          role="img"
          aria-label="Brooklyn Dig: a side-scrolling street level ending at Raf's Records"
          onPointerDown={start}
          style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated", touchAction: "none" }}
        />

        {hud.phase === "ready" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 12,
              background: "rgba(18, 24, 38, 0.72)",
              color: PALETTE.cream,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: "0.2em", color: PALETTE.amber }}>
              SECRET LEVEL UNLOCKED
            </p>
            <h2 className="text-balance" style={{ margin: 0, fontSize: 22, lineHeight: 1.1, fontWeight: 800 }}>
              Brooklyn Dig
            </h2>
            <p className="text-pretty" style={{ margin: 0, maxWidth: 260, fontSize: 13, lineHeight: 1.45 }}>
              Run to Raf&apos;s Records. Every record you grab makes the crate deeper.
            </p>
            <button
              type="button"
              onClick={start}
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
              Start
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          {controlButton("left", "Move left", <ChevronLeft size={28} aria-hidden="true" />, 60)}
          {controlButton("right", "Move right", <ChevronRight size={28} aria-hidden="true" />, 60)}
        </div>
        {controlButton("jump", "Jump", <ArrowUp size={28} aria-hidden="true" />, 76)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: PALETTE.cream, opacity: 0.75 }}>
          Arrows or WASD to run, Space to jump. Stomp the scratched CDs.
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
  )
}
