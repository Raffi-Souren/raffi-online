"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsRight,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react"
import { useWindowActivity } from "../../components/ui/WindowShell"
import { BRAWL_WAVES, createBrawl, stepBrawl, type BrawlStatus } from "../../lib/brawl-game"
import { drawBrawl } from "../../lib/brawl-scene"
import ScoreEntry from "./ScoreEntry"

type Control = "left" | "right" | "up" | "down" | "attack" | "jump" | "dodge"
const KEYS: Record<string, Control> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  j: "attack",
  " ": "jump",
  k: "dodge",
}
const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px solid #454357",
  borderRadius: 6,
  minHeight: 40,
  padding: "8px 12px",
  color: "#fcf1d6",
  background: "#645c7a",
  boxShadow: "0 3px 0 #302d43",
  fontWeight: 700,
  fontSize: 12,
}

export default function BlockPartyBrawl() {
  const { active } = useWindowActivity()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef(createBrawl())
  const runId = useRef(0)
  const keysRef = useRef(new Set<string>())
  const touchesRef = useRef(new Set<Control>())
  const pendingRef = useRef(new Set<Control>())
  const activeRef = useRef(active)
  const [status, setStatus] = useState<BrawlStatus>("ready")
  const [held, setHeld] = useState<Control[]>([])
  const [hud, setHud] = useState({ health: 100, score: 0, wave: 0, enemies: 3, combo: 0, dodge: 0 })
  const clearInput = useCallback(() => {
    keysRef.current.clear()
    touchesRef.current.clear()
    pendingRef.current.clear()
    setHeld([])
  }, [])
  const pause = useCallback(() => {
    if (gameRef.current.status !== "playing") return
    gameRef.current.status = "paused"
    setStatus("paused")
    clearInput()
  }, [clearInput])
  const resume = useCallback(() => {
    if (gameRef.current.status !== "paused") return
    gameRef.current.status = "playing"
    setStatus("playing")
  }, [])
  const start = useCallback(() => {
    clearInput()
    runId.current++
    gameRef.current = createBrawl()
    gameRef.current.status = "playing"
    setStatus("playing")
  }, [clearInput])

  useEffect(() => {
    activeRef.current = active
    if (!active) pause()
  }, [active, pause])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const keys = keysRef.current
    const touches = touchesRef.current
    const pending = pendingRef.current
    let frame = 0
    let previous = 0
    let lastHud = 0
    let oldStatus: BrawlStatus = "ready"
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    const animate = (timestamp: number) => {
      const dt = previous ? Math.min((timestamp - previous) / 1000, 0.05) : 1 / 60
      previous = timestamp
      const game = gameRef.current
      const down = (control: Control) =>
        pending.has(control) || touches.has(control) || Array.from(keys).some((key) => KEYS[key] === control)
      if (activeRef.current) {
        stepBrawl(
          game,
          {
            x: Number(down("right")) - Number(down("left")),
            y: Number(down("down")) - Number(down("up")),
            attack: down("attack"),
            jump: down("jump"),
            dodge: down("dodge"),
          },
          dt,
        )
        drawBrawl(context, game, canvas.width, canvas.height)
        pending.clear()
      }
      if (game.status !== oldStatus) {
        oldStatus = game.status
        setStatus(game.status)
        if (game.status === "won" || game.status === "lost") clearInput()
      }
      if (timestamp - lastHud > 90) {
        lastHud = timestamp
        setHud({
          health: game.player.health,
          score: game.score,
          wave: game.wave,
          enemies: game.enemies.length,
          combo: game.combo,
          dodge: game.dodgeCooldown,
        })
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    const keyDown = (event: KeyboardEvent) => {
      if (
        !activeRef.current ||
        (event.target instanceof HTMLElement &&
          (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable))
      )
        return
      const key = event.key.toLowerCase()
      if ((key === "escape" || key === "p") && !event.repeat) {
        event.preventDefault()
        if (gameRef.current.status === "paused") resume()
        else pause()
      } else if (key === "r" && !event.repeat) {
        start()
      } else if (KEYS[key] && gameRef.current.status === "playing") {
        if (key === " " && event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        keys.add(key)
        pending.add(KEYS[key])
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
    }
    const visibility = () => {
      if (document.hidden) pause()
    }
    const blur = () => {
      clearInput()
      pause()
    }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)
    window.addEventListener("blur", blur)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      keys.clear()
      touches.clear()
      pending.clear()
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
      window.removeEventListener("blur", blur)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [clearInput, pause, resume, start])

  const controlButton = (control: Control, label: string, icon: ReactNode, color?: string, shortcut?: string) => (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={held.includes(control)}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        touchesRef.current.add(control)
        pendingRef.current.add(control)
        setHeld(Array.from(touchesRef.current))
      }}
      onPointerUp={() => {
        touchesRef.current.delete(control)
        setHeld(Array.from(touchesRef.current))
      }}
      onPointerCancel={() => {
        touchesRef.current.delete(control)
        setHeld(Array.from(touchesRef.current))
      }}
      onLostPointerCapture={() => {
        touchesRef.current.delete(control)
        setHeld(Array.from(touchesRef.current))
      }}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault()
          event.stopPropagation()
          touchesRef.current.add(control)
          pendingRef.current.add(control)
          setHeld(Array.from(touchesRef.current))
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.stopPropagation()
          touchesRef.current.delete(control)
          setHeld(Array.from(touchesRef.current))
        }
      }}
      onBlur={() => {
        touchesRef.current.delete(control)
        setHeld(Array.from(touchesRef.current))
      }}
      className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      style={{
        ...buttonStyle,
        minWidth: 42,
        minHeight: 44,
        flex: 1,
        padding: "7px 4px",
        background: held.includes(control) ? "#383248" : color || "#625b72",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {icon}
      <span className={control === "attack" ? undefined : "hidden sm:inline"}>{label}</span>
      {shortcut && (
        <kbd
          aria-hidden="true"
          style={{
            font: "bold 11px monospace",
            padding: "2px 4px",
            border: "1px solid #f1dfbd88",
            borderRadius: 3,
            background: "#28223366",
          }}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  )

  return (
    <section
      aria-label="Block Party Brawl game"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 365,
        background: "#464052",
        color: "#faefd6",
        fontFamily: "'Trebuchet MS', Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          background: "#51485f",
          padding: "8px 12px",
          borderBottom: "2px solid #342e45",
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 15 }}>Block Party Brawl</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            aria-label={status === "paused" ? "Resume brawl" : "Pause brawl"}
            disabled={status !== "playing" && status !== "paused"}
            onClick={status === "paused" ? resume : pause}
            style={{
              ...buttonStyle,
              minHeight: 34,
              padding: "5px 9px",
              opacity: status !== "playing" && status !== "paused" ? 0.4 : 1,
            }}
          >
            {status === "paused" ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            type="button"
            aria-label="Restart brawl"
            onClick={start}
            style={{ ...buttonStyle, minHeight: 34, padding: "5px 9px" }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 190, overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          aria-label="A side-scrolling Brooklyn street with a headphone-wearing hero and speaker robots"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            pointerEvents: "none",
          }}
        >
          <div style={{ padding: "8px 10px", borderRadius: 6, background: "#383348dc", minWidth: 120 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <Heart size={13} fill="#e9a297" color="#e9a297" />
              <strong>{hud.health}</strong>
              <span style={{ color: "#c7bfcb" }}> / 100</span>
            </div>
            <div
              role="meter"
              aria-label="Player health"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={hud.health}
              style={{ height: 6, marginTop: 5, background: "#27253b", borderRadius: 3, overflow: "hidden" }}
            >
              <div
                style={{ width: `${hud.health}%`, height: "100%", background: hud.health < 30 ? "#ef8b83" : "#aad5bb" }}
              />
            </div>
          </div>
          <div
            style={{ textAlign: "right", padding: "8px 10px", borderRadius: 6, background: "#383348dc", fontSize: 11 }}
          >
            <strong style={{ fontSize: 13 }}>{BRAWL_WAVES[hud.wave]}</strong>
            <div>
              {hud.enemies} speakers left · {hud.score.toLocaleString()} pts
            </div>
          </div>
        </div>
        {hud.combo > 1 && status === "playing" && (
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 80,
              color: "#fff0bd",
              fontSize: 25,
              fontWeight: 900,
              fontStyle: "italic",
              textShadow: "2px 2px #5c486a",
            }}
          >
            {hud.combo} hit combo
          </div>
        )}
        {status !== "playing" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 14,
              display: status === "won" || status === "lost" ? "block" : "flex",
              alignItems: "center",
              justifyContent: "center",
              overflowY: "auto",
              overscrollBehavior: "contain",
              background: "#38314b60",
            }}
          >
            <div
              style={{
                width: "min(390px, 100%)",
                margin: status === "won" || status === "lost" ? "0 auto" : "auto",
                padding: "clamp(16px, 3vw, 24px)",
                borderRadius: 10,
                border: "3px solid #d39ab2",
                background: "#f3e6d0",
                color: "#4d445d",
                textAlign: "center",
                boxShadow: "0 7px 0 #382a4f50",
              }}
            >
              <h2 style={{ margin: "0 0 10px", fontWeight: 900, fontSize: 30, lineHeight: 1.06, letterSpacing: -1 }}>
                {status === "ready"
                  ? "Save the block party."
                  : status === "paused"
                    ? "On a break."
                    : status === "won"
                      ? "Turn it up. You did it."
                      : "One more round?"}
              </h2>
              <p style={{ fontSize: 13, margin: "0 0 15px", lineHeight: 1.5 }}>
                {status === "ready"
                  ? "Rogue speakers stole the sound system. Clear three blocks and bring the music home."
                  : status === "paused"
                    ? "The neighborhood can wait a minute."
                    : status === "won"
                      ? `All three blocks cleared. ${hud.score.toLocaleString()} points. The party is back.`
                      : `${hud.score.toLocaleString()} points. Watch for the warning rings, then jump or dodge.`}
              </p>
              {status === "ready" && (
                <div
                  style={{
                    textAlign: "left",
                    background: "#e5d9c9",
                    borderRadius: 5,
                    padding: "10px 12px",
                    fontSize: 12,
                    lineHeight: 1.8,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <strong>Arrows / WASD</strong> move &nbsp; <strong>J</strong> punch
                  </div>
                  <div>
                    <strong>Space</strong> jump &nbsp; <strong>K</strong> dodge
                  </div>
                  <div>Jump + punch for a kick. Avoid warning rings.</div>
                  <div>Grab health drops. Follow the arrows between blocks.</div>
                  <div>Touch controls below. Esc pauses; R restarts.</div>
                </div>
              )}
              <button
                type="button"
                onClick={status === "paused" ? resume : start}
                style={{ ...buttonStyle, background: "#925274", padding: "12px 24px", minHeight: 46 }}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-800"
              >
                <Play size={16} fill="currentColor" />
                {status === "ready" ? "Hit the street" : status === "paused" ? "Back to the block" : "Play again"}
              </button>
              {(status === "won" || status === "lost") && (
                <div style={{ marginTop: 16 }}>
                  <ScoreEntry
                    key={`block-party-brawl-${runId.current}`}
                    gameName="block-party-brawl"
                    score={gameRef.current.score}
                    level={gameRef.current.wave + 1}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          padding: "9px 10px 12px",
          borderTop: "2px solid #342e45",
          flexShrink: 0,
        }}
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(42px, 1fr))", gap: 3, flex: "0 1 220px" }}
        >
          <span />
          {controlButton("up", "Move up", <ArrowUp size={18} />)}
          <span />
          {controlButton("left", "Move left", <ArrowLeft size={18} />)}
          {controlButton("down", "Move down", <ArrowDown size={18} />)}
          {controlButton("right", "Move right", <ArrowRight size={18} />)}
        </div>
        <div style={{ display: "flex", gap: 6, flex: "1 1 auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {controlButton("dodge", "Dodge", <ChevronsRight size={20} />, "#5c7890")}
          {controlButton("jump", "Jump", <ArrowUp size={20} />, "#817087")}
          {controlButton("attack", "Punch", <Zap size={20} />, "#a65e7b", "J")}
          <span style={{ flexBasis: "100%", textAlign: "right", fontSize: 10, color: "#d8ceda" }}>
            {hud.dodge > 0 ? "Dodge recharging…" : "Dodge ready"}
          </span>
        </div>
      </div>
      <span role="status" className="sr-only">
        {status === "won"
          ? "All three blocks cleared. You win."
          : status === "lost"
            ? "Out of health. Game over."
            : status === "paused"
              ? "Game paused."
              : ""}
      </span>
    </section>
  )
}
