"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { Crosshair, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { createSignalState, startSignal, stepSignal, type SignalInput, type SignalState } from "@/lib/signal-lost"
import { createSignalArt, renderSignal } from "@/lib/signal-lost-render"
import ScoreEntry from "./ScoreEntry"

const EMPTY_INPUT: SignalInput = { forward: 0, strafe: 0, turn: 0, sprint: false, fire: false }
const panel: CSSProperties = { background: "rgba(18,31,41,.9)", border: "1px solid #63736f", color: "#ecdfbd" }
const button: CSSProperties = {
  ...panel,
  minHeight: 36,
  padding: "7px 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontSize: 12,
  cursor: "pointer",
  borderRadius: 3,
}

function readHud(s: SignalState) {
  return {
    phase: s.phase,
    health: s.health,
    heat: Math.round(s.heat),
    overheated: s.overheated,
    wave: s.wave,
    enemies: s.enemies.filter((e) => e.hp > 0).length,
    kills: s.kills,
    time: Math.floor(s.time),
    message: s.messageTime > 0 ? s.message : "",
  }
}

export default function SignalLostGame() {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef(createSignalState()),
    keys = useRef(new Set<string>())
  const touchInput = useRef({ ...EMPTY_INPUT }),
    look = useRef<{ id: number; x: number } | null>(null)
  const queuedShot = useRef(false)
  const heldControls = useRef(new Map<number, Partial<SignalInput>>())
  const audio = useRef<AudioContext | null>(null),
    muted = useRef(false)
  const [hud, setHud] = useState(() => readHud(state.current)),
    [sound, setSound] = useState(true),
    [touch, setTouch] = useState(false),
    [compact, setCompact] = useState(false)
  const [runId, setRunId] = useState(0)

  const tone = useCallback((frequency: number, duration: number, type: OscillatorType = "triangle") => {
    if (!audio.current || muted.current || audio.current.state !== "running") return
    const oscillator = audio.current.createOscillator(),
      gain = audio.current.createGain(),
      now = audio.current.currentTime
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.25), now + duration)
    gain.gain.setValueAtTime(0.055, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(gain)
    gain.connect(audio.current.destination)
    oscillator.start()
    oscillator.stop(now + duration)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
  }, [])

  const releaseInput = useCallback(() => {
    keys.current.clear()
    touchInput.current = { ...EMPTY_INPUT }
    look.current = null
    queuedShot.current = false
    heldControls.current.clear()
  }, [])
  const sync = useCallback(() => setHud(readHud(state.current)), [])
  const pause = useCallback(() => {
    if (state.current.phase !== "playing") return
    state.current.phase = "paused"
    releaseInput()
    sync()
    if (document.pointerLockElement === canvas.current) document.exitPointerLock()
  }, [releaseInput, sync])

  const play = (restart = false) => {
    if (restart || state.current.phase === "ready" || state.current.phase === "won" || state.current.phase === "lost") {
      state.current = createSignalState()
      startSignal(state.current)
      setRunId((id) => id + 1)
    } else state.current.phase = "playing"
    releaseInput()
    sync()
    canvas.current?.focus()
    try {
      audio.current ||= new AudioContext()
      void audio.current.resume().catch(() => {})
    } catch {
      /* Audio is optional. */
    }
  }

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext("2d")
    if (!ctx) return
    const art = createSignalArt()
    const coarse = window.matchMedia("(pointer: coarse)")
    const syncTouch = () => setTouch(coarse.matches)
    syncTouch()
    coarse.addEventListener("change", syncTouch)
    const resize = () => {
      const box = el.getBoundingClientRect(),
        width = Math.max(320, Math.min(960, Math.round(box.width)))
      setCompact(box.height < 360)
      el.width = width
      el.height = Math.max(220, Math.round((width * box.height) / Math.max(1, box.width)))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest("input, textarea, select"))
      )
        return
      if (!root.current?.contains(document.activeElement) && document.pointerLockElement !== el) return
      if (["Escape", "KeyP"].includes(event.code)) {
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) pause()
        return
      }
      if (document.activeElement !== el && document.pointerLockElement !== el) return
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "ShiftLeft",
          "ShiftRight",
        ].includes(event.code) &&
        state.current.phase === "playing"
      ) {
        event.preventDefault()
        keys.current.add(event.code)
        if (event.code === "Space" && !event.repeat) queuedShot.current = true
      }
    }
    const keyUp = (event: KeyboardEvent) => keys.current.delete(event.code)
    const pointerUp = (event: globalThis.PointerEvent) => {
      const control = heldControls.current.get(event.pointerId)
      if (control) {
        for (const key of Object.keys(control) as (keyof SignalInput)[]) {
          Object.assign(touchInput.current, { [key]: EMPTY_INPUT[key] })
        }
        heldControls.current.delete(event.pointerId)
      }
      if (look.current?.id === event.pointerId) look.current = null
      if (event.pointerType === "mouse") touchInput.current.fire = false
    }
    const moveMouse = (event: MouseEvent) => {
      if (document.pointerLockElement === el && state.current.phase === "playing")
        state.current.angle += event.movementX * 0.003
    }
    const unlock = () => {
      if (document.pointerLockElement !== el) {
        releaseInput()
        if (state.current.phase === "playing") pause()
      }
    }
    const visibility = () => {
      if (document.hidden) pause()
    }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)
    window.addEventListener("pointerup", pointerUp)
    window.addEventListener("pointercancel", pointerUp)
    window.addEventListener("blur", pause)
    document.addEventListener("mousemove", moveMouse)
    document.addEventListener("pointerlockchange", unlock)
    document.addEventListener("visibilitychange", visibility)
    let frame = 0,
      last = performance.now(),
      uiAt = 0
    const loop = (now: number) => {
      const s = state.current,
        wasPhase = s.phase,
        beforeShot = s.cooldown,
        beforeHurt = s.hurt,
        beforeKills = s.kills
      const input = touchInput.current,
        pressed = (key: string) => (keys.current.has(key) ? 1 : 0)
      stepSignal(
        s,
        {
          forward: input.forward + pressed("KeyW") + pressed("ArrowUp") - pressed("KeyS") - pressed("ArrowDown"),
          strafe: input.strafe + pressed("KeyD") - pressed("KeyA"),
          turn: input.turn + pressed("ArrowRight") - pressed("ArrowLeft"),
          sprint: keys.current.has("ShiftLeft") || keys.current.has("ShiftRight"),
          fire: input.fire || keys.current.has("Space") || queuedShot.current,
        },
        (now - last) / 1000,
      )
      queuedShot.current = false
      if (s.cooldown > beforeShot) tone(380, 0.09, "sawtooth")
      if (s.hurt > beforeHurt) tone(90, 0.18, "square")
      if (s.kills > beforeKills) tone(660, 0.15)
      renderSignal(ctx, s, art)
      if (now - uiAt > 80 || s.phase !== wasPhase) {
        setHud(readHud(s))
        uiAt = now
      }
      if (s.phase !== wasPhase && (s.phase === "won" || s.phase === "lost")) {
        releaseInput()
        if (document.pointerLockElement === el) document.exitPointerLock()
      }
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      coarse.removeEventListener("change", syncTouch)
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
      window.removeEventListener("pointerup", pointerUp)
      window.removeEventListener("pointercancel", pointerUp)
      window.removeEventListener("blur", pause)
      document.removeEventListener("mousemove", moveMouse)
      document.removeEventListener("pointerlockchange", unlock)
      document.removeEventListener("visibilitychange", visibility)
      if (document.pointerLockElement === el) document.exitPointerLock()
      void audio.current?.close().catch(() => {})
      audio.current = null
    }
  }, [pause, releaseInput, tone])

  const lookStart = (event: PointerEvent<HTMLCanvasElement>) => {
    if (state.current.phase !== "playing") return
    event.currentTarget.focus()
    if (event.pointerType === "mouse") {
      touchInput.current.fire = true
      queuedShot.current = true
      if (document.pointerLockElement !== event.currentTarget) {
        try {
          void Promise.resolve(event.currentTarget.requestPointerLock()).catch(() => {})
        } catch {
          /* Arrow keys and drag look remain available. */
        }
      }
    }
    look.current = { id: event.pointerId, x: event.clientX }
    // Pointer lock and pointer capture are mutually exclusive in Chromium.
    // Mouse release is handled on window, including when lock is declined.
    if (event.pointerType !== "mouse") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* Window release also clears drag state. */
      }
    }
  }

  const touchButton = (label: string, value: Partial<SignalInput>, children: ReactNode, style?: CSSProperties) => (
    <button
      type="button"
      aria-label={label}
      style={{ ...button, width: 48, height: 46, padding: 0, touchAction: "none", userSelect: "none", ...style }}
      onPointerDown={(event) => {
        event.preventDefault()
        heldControls.current.set(event.pointerId, value)
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* Window release clears this control. */
        }
        Object.assign(touchInput.current, value)
        if (value.fire) queuedShot.current = true
      }}
      onPointerUp={() => {
        for (const key of Object.keys(value) as (keyof SignalInput)[])
          Object.assign(touchInput.current, { [key]: EMPTY_INPUT[key] })
      }}
      onPointerCancel={() => {
        touchInput.current = { ...EMPTY_INPUT }
      }}
      onLostPointerCapture={() => {
        for (const key of Object.keys(value) as (keyof SignalInput)[])
          Object.assign(touchInput.current, { [key]: EMPTY_INPUT[key] })
      }}
    >
      {children}
    </button>
  )

  const active = hud.phase === "playing"
  return (
    <div
      ref={root}
      data-game="signal-lost"
      data-phase={hud.phase}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 220,
        flex: "1 1 auto",
        overflow: "hidden",
        background: "#172633",
        color: "#ecdfbd",
        fontFamily: "Tahoma, sans-serif",
      }}
    >
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Signal Lost first-person view. WASD moves, arrows turn, Space fires, P pauses."
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          minHeight: 220,
          touchAction: "none",
          outline: "none",
        }}
        onPointerDown={lookStart}
        onPointerMove={(event) => {
          if (look.current?.id === event.pointerId && document.pointerLockElement !== canvas.current && active) {
            state.current.angle += (event.clientX - look.current.x) * 0.006
            look.current.x = event.clientX
          }
        }}
        onPointerUp={() => {
          look.current = null
          touchInput.current.fire = false
        }}
        onPointerCancel={releaseInput}
        onLostPointerCapture={() => {
          look.current = null
          touchInput.current.fire = false
        }}
      />
      <div style={{ position: "absolute", top: 14, left: 16, pointerEvents: "none", textShadow: "0 2px 6px #000" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>SIGNAL LOST</div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#d4c8ae" }}>
          {hud.wave
            ? hud.wave === 3 && !hud.enemies
              ? "Reach the green exit on your map"
              : `Sector ${hud.wave} / 3 · ${hud.enemies} signals remaining`
            : "Brooklyn / Substation 04"}
        </div>
      </div>
      <div style={{ position: "absolute", right: 12, top: 12, display: "flex", gap: 6 }}>
        <button
          type="button"
          style={button}
          aria-label={sound ? "Mute game sound" : "Enable game sound"}
          onClick={() => {
            muted.current = !muted.current
            setSound(!muted.current)
          }}
        >
          {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        {active && (
          <button type="button" style={button} onClick={pause} aria-label="Pause Signal Lost">
            <Pause size={15} />
          </button>
        )}
      </div>
      {active && (
        <>
          {hud.message && (
            <div
              role="status"
              style={{
                position: "absolute",
                top: 64,
                left: 16,
                maxWidth: "calc(100% - 126px)",
                fontSize: 11,
                color: "#edcd8d",
                lineHeight: 1.5,
                textShadow: "0 2px 4px #000",
                pointerEvents: "none",
              }}
            >
              {hud.message}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              bottom: touch && !compact ? 121 : 17,
              left: touch && compact ? 184 : 16,
              display: "flex",
              gap: 16,
              pointerEvents: "none",
            }}
          >
            <div style={{ ...panel, padding: "7px 10px", minWidth: 100 }}>
              <span style={{ fontSize: 10 }}>Integrity</span>
              <strong style={{ float: "right", fontSize: 14 }}>{hud.health}</strong>
              <div style={{ height: 3, background: "#3d4b4f", marginTop: 7 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${hud.health}%`,
                    background: hud.health < 30 ? "#e8997b" : "#a5c5ad",
                  }}
                />
              </div>
            </div>
            <div style={{ ...panel, padding: "7px 10px", minWidth: 100 }}>
              <span style={{ fontSize: 10 }}>{hud.overheated ? "Cooling…" : "Coil heat"}</span>
              <strong style={{ float: "right", fontSize: 14 }}>{hud.heat}</strong>
              <div style={{ height: 3, background: "#3d4b4f", marginTop: 7 }}>
                <div style={{ height: "100%", width: `${hud.heat}%`, background: "#e0b579" }} />
              </div>
            </div>
          </div>
          {touch ? (
            <>
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 48px)",
                  gap: 4,
                }}
              >
                <span />
                {touchButton("Move forward", { forward: 1 }, "↑")}
                <span />
                {touchButton("Strafe left", { strafe: -1 }, "←")}
                {touchButton("Move backward", { forward: -1 }, "↓")}
                {touchButton("Strafe right", { strafe: 1 }, "→")}
              </div>
              <div style={{ position: "absolute", bottom: 17, right: 16 }}>
                {touchButton("Fire pulse blaster", { fire: true }, <Crosshair size={27} />, {
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderColor: "#c9d7b7",
                })}
                <div style={{ textAlign: "center", fontSize: 10, marginTop: 5 }}>Drag view to aim</div>
              </div>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                right: 16,
                bottom: 18,
                fontSize: 10,
                color: "#d6cbb6",
                textShadow: "0 1px 4px #000",
              }}
            >
              WASD move · Mouse / arrows aim · Click / Space fire · P pause
            </div>
          )}
        </>
      )}
      {!active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(9,21,30,.78)",
            overflowY: "auto",
          }}
        >
          <div style={{ maxWidth: 410, width: "100%", maxHeight: "100%", overflowY: "auto", margin: "auto 0" }}>
            <div style={{ color: "#cba36f", fontSize: 12, marginBottom: 10 }}>
              {hud.phase === "ready"
                ? "After hours at Substation 04"
                : hud.phase === "paused"
                  ? "The city can wait."
                  : `${hud.kills} signals cleared · ${hud.time}s underground`}
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: "Impact, Arial Narrow, sans-serif",
                fontSize: compact ? 42 : "clamp(42px, 7vw, 78px)",
                lineHeight: 0.98,
                fontWeight: 400,
                letterSpacing: -1,
              }}
            >
              {hud.phase === "ready" && compact ? (
                "SIGNAL LOST"
              ) : hud.phase === "ready" ? (
                <>
                  SIGNAL
                  <br />
                  LOST
                </>
              ) : hud.phase === "paused" ? (
                "TAKE A BREATH."
              ) : hud.phase === "won" ? (
                "BACK ON AIR."
              ) : (
                "SIGNAL DROPPED."
              )}
            </h2>
            <p
              style={{
                fontSize: compact ? 11 : 13,
                color: "#c5c4b4",
                lineHeight: 1.65,
                margin: compact ? "10px 0" : "18px 0",
              }}
            >
              {hud.phase === "ready"
                ? "The sound system has gone rogue. Clear three sectors of speaker drones, then find the green exit. Amber cones mean an incoming shot: strafe out of the way."
                : hud.phase === "paused"
                  ? "Line up the crosshair. Fire in short bursts. Service packs restore integrity and cool your blaster."
                  : hud.phase === "won"
                    ? "The substation is quiet. Brooklyn has its signal back."
                    : "Keep moving when a speaker glows amber. Use corners for cover, and let the coil cool between bursts."}
            </p>
            {(hud.phase === "won" || hud.phase === "lost") && (
              <ScoreEntry
                key={`signal-lost-${runId}`}
                gameName="signal-lost"
                score={hud.kills * 100 + (hud.phase === "won" ? 1000 + Math.max(0, 300 - hud.time) : 0)}
                level={hud.wave}
              />
            )}
            <button
              type="button"
              onClick={() => play()}
              style={{
                ...button,
                color: "#182b35",
                background: "#e0c18a",
                borderColor: "#e0c18a",
                minHeight: 46,
                padding: "12px 18px",
                fontWeight: 700,
              }}
            >
              <Play size={16} />
              {hud.phase === "ready"
                ? "Enter the substation"
                : hud.phase === "paused"
                  ? "Resume transmission"
                  : "Run it again"}
            </button>
            {hud.phase === "paused" && (
              <button type="button" onClick={() => play(true)} style={{ ...button, marginLeft: 8, minHeight: 46 }}>
                <RotateCcw size={14} />
                Restart
              </button>
            )}
            <p style={{ fontSize: 10, lineHeight: 1.6, color: "#a2b1b8", margin: "16px 0 0" }}>
              {touch
                ? "Left buttons move. Drag the view to aim. Right button fires."
                : "WASD moves · Mouse / arrows aim · Click / Space fires · Shift sprints · P pauses"}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
