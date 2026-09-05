"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw, Zap } from "lucide-react"
import { useWindowActivity } from "../../components/ui/WindowShell"
import {
  createMatch,
  matchPoints,
  pauseMatch,
  resumeMatch,
  stepMatch,
  type MatchPhase,
} from "../../lib/overtime-engine"
import { createOvertimeScene } from "../../lib/overtime-scene"
import ScoreEntry from "./ScoreEntry"

type Control = "left" | "right" | "forward" | "reverse" | "boost" | "jump"
const KEY_MAP: Record<string, Control> = {
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  w: "forward",
  arrowup: "forward",
  s: "reverse",
  arrowdown: "reverse",
  shift: "boost",
  " ": "jump",
}
const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 42,
  padding: "8px 13px",
  border: "1px solid #788b9a",
  borderRadius: 6,
  color: "#183346",
  background: "#eaf2ef",
  fontWeight: 700,
  fontSize: 13,
}
const focusClass =
  "hover:brightness-110 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input,textarea,select,[contenteditable='true']"))
}

const INITIAL_HUD = {
  seconds: 90,
  blue: 0,
  orange: 0,
  extra: false,
  fuel: 80,
  countdown: 3,
  x: -15,
  z: 0,
  angle: 0,
  height: 0,
  ballX: 0,
  ballZ: 0,
  hits: 0,
  goal: "",
}

export default function OvertimeGame() {
  const { active } = useWindowActivity()
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef(createMatch())
  const activeRef = useRef(active)
  const keyboard = useRef(new Set<string>())
  const touches = useRef(new Map<number, Control>())
  const runId = useRef(0)
  const [phase, setPhase] = useState<MatchPhase>("ready")
  const [error, setError] = useState(false)
  const [held, setHeld] = useState<Control[]>([])
  const [hud, setHud] = useState(INITIAL_HUD)

  const clearControls = useCallback(() => {
    keyboard.current.clear()
    touches.current.clear()
    setHeld([])
  }, [])
  const pause = useCallback(() => {
    pauseMatch(gameRef.current)
    setPhase(gameRef.current.phase)
    clearControls()
  }, [clearControls])
  const start = useCallback(() => {
    clearControls()
    runId.current++
    setHud({ ...INITIAL_HUD })
    gameRef.current = createMatch()
    gameRef.current.phase = "kickoff"
    setPhase("kickoff")
  }, [clearControls])
  const resume = useCallback(() => {
    clearControls()
    resumeMatch(gameRef.current)
    setPhase(gameRef.current.phase)
  }, [clearControls])
  useEffect(() => {
    activeRef.current = active
    if (!active) pause()
  }, [active, pause])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let scene: ReturnType<typeof createOvertimeScene>
    try {
      scene = createOvertimeScene(host)
    } catch {
      setError(true)
      return
    }
    let frame = 0,
      previous = 0,
      lastHud = 0,
      lastPhase: MatchPhase = "ready"
    const render = (time: number) => {
      const dt = previous ? Math.min((time - previous) / 1000, 0.1) : 1 / 60
      previous = time
      const match = gameRef.current
      const pressed = (control: Control) =>
        Array.from(keyboard.current).some((key) => KEY_MAP[key] === control) ||
        Array.from(touches.current.values()).includes(control)
      if (activeRef.current) {
        stepMatch(
          match,
          {
            steer: Number(pressed("right")) - Number(pressed("left")),
            throttle: Number(pressed("forward")) - Number(pressed("reverse")),
            boost: pressed("boost"),
            jump: pressed("jump"),
          },
          dt,
        )
        scene.render(match)
      }
      if (match.phase !== lastPhase) {
        lastPhase = match.phase
        setPhase(match.phase)
      }
      if (time - lastHud > 80) {
        lastHud = time
        setHud({
          seconds: Math.ceil(match.seconds),
          blue: match.blue,
          orange: match.orange,
          extra: match.extraTime,
          fuel: Math.round(match.player.boost),
          countdown: Math.max(1, Math.ceil(match.countdown)),
          x: match.player.x,
          z: match.player.z,
          angle: match.player.angle,
          height: match.player.height,
          ballX: match.ball.x,
          ballZ: match.ball.z,
          hits: match.hits,
          goal: match.lastGoal === "blue" ? "You scored!" : "Rival scored",
        })
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    const keys = keyboard.current,
      pointers = touches.current
    return () => {
      cancelAnimationFrame(frame)
      keys.clear()
      pointers.clear()
      scene.dispose()
    }
  }, [])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!activeRef.current || isTyping(event.target)) return
      const key = event.key.toLowerCase(),
        current = gameRef.current.phase
      if (key === "escape" || key === "p") {
        event.preventDefault()
        if (!event.repeat) {
          if (current === "paused") resume()
          else pause()
        }
      } else if (key === "r" && (current === "paused" || current === "finished")) {
        event.preventDefault()
        if (!event.repeat) start()
      } else if (KEY_MAP[key] && (current === "playing" || current === "kickoff")) {
        event.preventDefault()
        keyboard.current.add(key)
      }
    }
    const keyUp = (event: KeyboardEvent) => keyboard.current.delete(event.key.toLowerCase())
    const hidden = () => {
      if (document.hidden) pause()
    }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)
    window.addEventListener("blur", pause)
    document.addEventListener("visibilitychange", hidden)
    return () => {
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
      window.removeEventListener("blur", pause)
      document.removeEventListener("visibilitychange", hidden)
    }
  }, [pause, resume, start])

  const touchButton = (control: Control, label: string, content: React.ReactNode, accent = false) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={held.includes(control)}
      onPointerDown={(event) => {
        if (phase !== "playing" && phase !== "kickoff") return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        touches.current.set(event.pointerId, control)
        setHeld(Array.from(touches.current.values()))
      }}
      onPointerUp={(event) => {
        touches.current.delete(event.pointerId)
        setHeld(Array.from(touches.current.values()))
      }}
      onPointerCancel={(event) => {
        touches.current.delete(event.pointerId)
        setHeld(Array.from(touches.current.values()))
      }}
      onLostPointerCapture={(event) => {
        touches.current.delete(event.pointerId)
        setHeld(Array.from(touches.current.values()))
      }}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        ...buttonStyle,
        width: "clamp(38px, 8vw, 58px)",
        minHeight: 44,
        padding: 6,
        touchAction: "none",
        userSelect: "none",
        background: held.includes(control) ? "#91d5e8" : accent ? "#e8b868" : "#dce6e9",
        boxShadow: "0 2px 0 #102938",
      }}
      className={focusClass}
    >
      {content}
    </button>
  )
  const finished = phase === "finished"
  const match = gameRef.current
  const minutes = Math.floor(hud.seconds / 60),
    seconds = String(hud.seconds % 60).padStart(2, "0")
  const overlay = error || phase === "ready" || phase === "paused" || finished

  return (
    <section
      data-game="overtime"
      data-phase={phase}
      data-player-x={hud.x.toFixed(2)}
      data-player-z={hud.z.toFixed(2)}
      data-player-angle={hud.angle.toFixed(3)}
      data-player-height={hud.height.toFixed(3)}
      data-ball-x={hud.ballX.toFixed(2)}
      data-ball-z={hud.ballZ.toFixed(2)}
      data-hits={hud.hits}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        minHeight: 260,
        color: "#e8f4f0",
        background: "#20394a",
        fontFamily: "'Trebuchet MS', Arial, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "5px 10px",
          minHeight: 43,
          flexShrink: 0,
          borderBottom: "1px solid #4d6978",
        }}
      >
        <strong style={{ fontSize: "clamp(13px, 3vw, 17px)", letterSpacing: -0.5 }}>Overtime</strong>
        <div
          aria-label={`You ${hud.blue}, rival ${hud.orange}. ${minutes} minutes ${seconds} seconds${hud.extra ? ", golden goal" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 900,
          }}
        >
          <span style={{ color: "#8ee7ff", fontSize: 22 }}>{hud.blue}</span>
          <span style={{ textAlign: "center", fontSize: 14 }}>
            {minutes}:{seconds}
            {hud.extra && <small style={{ display: "block", fontSize: 9, color: "#f6cb7e" }}>Golden goal</small>}
          </span>
          <span style={{ color: "#ffbd76", fontSize: 22 }}>{hud.orange}</span>
        </div>
        <button
          type="button"
          aria-label="Pause Overtime"
          onClick={pause}
          disabled={overlay}
          style={{ ...buttonStyle, minHeight: 32, padding: 6, background: "#dbe8e9", opacity: overlay ? 0.45 : 1 }}
          className={focusClass}
        >
          <Pause size={16} />
        </button>
      </header>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 155, overflow: "hidden" }}>
        <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 9,
            left: 10,
            fontSize: 11,
            color: "#b4eefe",
            textShadow: "0 1px 3px #142536",
            pointerEvents: "none",
          }}
        >
          You: blue car · Score in orange
        </div>
        {(phase === "kickoff" || phase === "goal") && (
          <div
            role="status"
            style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}
          >
            <div
              style={{
                padding: "10px 24px",
                background: "#192f47e8",
                border: "1px solid #8cbbc5",
                borderRadius: 8,
                fontSize: phase === "goal" ? 28 : 48,
                fontWeight: 900,
                boxShadow: "0 7px 35px #10223070",
              }}
            >
              {phase === "goal" ? hud.goal : hud.countdown}
            </div>
          </div>
        )}
      </div>
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "7px 9px 9px",
          flexShrink: 0,
          background: "#263f50",
          borderTop: "1px solid #59707c",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {touchButton("left", "Steer left", <ArrowLeft size={21} />)}
          {touchButton("right", "Steer right", <ArrowRight size={21} />)}
          {touchButton("reverse", "Brake or reverse", <ArrowDown size={20} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {touchButton("jump", "Jump", <span style={{ fontSize: 11 }}>Jump</span>)}
          <div style={{ position: "relative" }}>
            {touchButton("boost", "Boost", <Zap size={19} />, true)}
            <meter
              aria-label="Boost fuel"
              min={0}
              max={100}
              value={hud.fuel}
              style={{
                position: "absolute",
                bottom: -5,
                left: 2,
                width: "calc(100% - 4px)",
                height: 8,
                accentColor: "#ffd77d",
                pointerEvents: "none",
              }}
            />
          </div>
          {touchButton("forward", "Accelerate", <ArrowUp size={23} />, true)}
        </div>
      </footer>
      {overlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            overflowY: "auto",
            display: "flex",
            padding: 14,
            background: "#142d429c",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              margin: "auto",
              flexShrink: 0,
              padding: "clamp(15px, 3vw, 24px)",
              border: "1px solid #879da8",
              borderRadius: 10,
              background: "#203b4cf7",
              boxShadow: "0 10px 50px #081e3b75",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
              {error
                ? "Arena unavailable"
                : phase === "paused"
                  ? "Time out."
                  : finished
                    ? match.blue > match.orange
                      ? "Your rooftop."
                      : match.blue === match.orange
                        ? "Honors even."
                        : "Rematch?"
                    : "Own the rooftop."}
            </h2>
            {error ? (
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                This arena needs WebGL. Enable hardware acceleration or try another browser, then reopen the game.
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "#d2e1e6" }}>
                  {finished
                    ? `${match.blue}–${match.orange}. ${matchPoints(match)} points. 100 per goal + 250 for a win.`
                    : phase === "paused"
                      ? "The clock is stopped. Pick up where you left off."
                      : "Blue car. Orange goal. One rival, 90 seconds. Drive through the ball to shoot; jump for a chip. A tie goes to golden goal."}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={phase === "paused" ? resume : start}
                    style={{ ...buttonStyle, background: "#bce8e5" }}
                    className={focusClass}
                  >
                    <Play size={16} />
                    {phase === "paused" ? "Resume match" : finished ? "Play again" : "Kick off"}
                  </button>
                  {phase === "paused" && (
                    <button type="button" onClick={start} style={buttonStyle} className={focusClass}>
                      <RotateCcw size={15} />
                      Restart
                    </button>
                  )}
                </div>
                {phase === "ready" && (
                  <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.7, color: "#b3cbd5" }}>
                    <div>
                      <strong style={{ color: "#eef5ee" }}>W / ↑</strong> accelerate ·{" "}
                      <strong style={{ color: "#eef5ee" }}>S / ↓</strong> brake / reverse
                    </div>
                    <div>
                      <strong style={{ color: "#eef5ee" }}>A D / ← →</strong> steer ·{" "}
                      <strong style={{ color: "#eef5ee" }}>Shift</strong> boost ·{" "}
                      <strong style={{ color: "#eef5ee" }}>Space</strong> jump
                    </div>
                    <div>Gold pads refill boost. Touch controls work below.</div>
                  </div>
                )}
                {finished && (
                  <div style={{ marginTop: 16 }}>
                    <ScoreEntry key={runId.current} gameName="overtime" score={matchPoints(match)} level={1} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
