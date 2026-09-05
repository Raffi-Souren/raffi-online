"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react"
import { useWindowActivity } from "../../components/ui/WindowShell"
import { loadGameProgress, readGameStorage, saveGameProgress, writeGameStorage } from "@/lib/game-utils"
import {
  BRICK_LEVELS,
  FIELD,
  PICKUPS,
  createBrickbreaker,
  nextBrickLevel,
  pauseBrickbreaker,
  startBrickbreaker,
  stepBrickbreaker,
  type BrickRun,
} from "@/lib/brickbreaker-engine"
import { drawBrickbreaker } from "@/lib/brickbreaker-render"
import ScoreEntry from "./ScoreEntry"
import Leaderboard from "./Leaderboard"

const button: CSSProperties = {
  minHeight: 42,
  border: "1px solid #6f7c8d",
  borderRadius: 5,
  padding: "8px 12px",
  background: "linear-gradient(#465264, #293340)",
  color: "#f0f3f7",
  fontSize: 12,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
  boxShadow: "inset 0 1px #ffffff20, 0 2px 0 #111922",
}
const primary: CSSProperties = { ...button, background: "linear-gradient(#557bc7, #294b94)", borderColor: "#91b5ec" }
const blankInput = () => ({
  keys: new Set<string>(),
  touches: new Set<string>(),
  target: undefined as number | undefined,
  shot: false,
})
const snapshot = (g: BrickRun) => ({
  phase: g.phase,
  aim: g.aim,
  paused: g.paused,
  level: g.level,
  lives: g.lives,
  score: g.score,
  rockets: g.rockets,
  powers: { ...g.powers },
  message: g.messageTime > 0 ? g.message : "",
  held: g.balls.some((b) => b.held),
  practice: g.practice,
})

export default function Brickbreaker() {
  const { active } = useWindowActivity()
  const activeRef = useRef(active)
  const game = useRef(createBrickbreaker())
  const canvas = useRef<HTMLCanvasElement>(null)
  const input = useRef(blankInput())
  const drag = useRef<{ id: number; x: number; paddle: number } | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const soundOn = useRef(false)
  const progress = useRef(loadGameProgress("brickbreaker"))
  const runId = useRef(0)
  const stageStartScore = useRef(0)
  const [hud, setHud] = useState(() => snapshot(game.current))
  const [screen, setScreen] = useState<"game" | "help" | "levels" | "scores">("game")
  const screenRef = useRef(screen)
  const [best, setBest] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const publish = useCallback(() => setHud(snapshot(game.current)), [])
  const clearInput = useCallback(() => {
    input.current = blankInput()
    drag.current = null
  }, [])
  const pause = useCallback(() => {
    if (["serve", "playing"].includes(game.current.phase)) {
      pauseBrickbreaker(game.current, true)
      clearInput()
      publish()
    }
  }, [clearInput, publish])
  const resume = () => {
    pauseBrickbreaker(game.current, false)
    clearInput()
    publish()
    canvas.current?.focus()
  }
  const start = (level = 1, practice = false) => {
    game.current = createBrickbreaker(level, practice)
    startBrickbreaker(game.current)
    stageStartScore.current = 0
    runId.current++
    clearInput()
    setScreen("game")
    publish()
    canvas.current?.focus()
  }
  const menu = () => {
    game.current = createBrickbreaker()
    clearInput()
    setScreen("game")
    publish()
  }
  const next = () => {
    stageStartScore.current = game.current.score
    nextBrickLevel(game.current)
    clearInput()
    publish()
    canvas.current?.focus()
  }
  const openScreen = (view: typeof screen) => {
    pause()
    setScreen(view)
  }
  const toggleSound = () => {
    if (!audio.current) {
      try {
        audio.current = new AudioContext()
      } catch {
        return
      }
    }
    soundOn.current = !soundOn.current
    setSoundEnabled(soundOn.current)
    if (soundOn.current) void audio.current.resume().catch(() => {})
  }
  useEffect(() => {
    activeRef.current = active
    if (!active) pause()
  }, [active, pause])
  useEffect(() => {
    screenRef.current = screen
  }, [screen])
  useEffect(() => {
    const value = Number(readGameStorage("brickbreaker_circuit_best"))
    setBest(Number.isFinite(value) && value > 0 ? value : 0)
    progress.current = loadGameProgress("brickbreaker")
    return () => {
      void audio.current?.close().catch(() => {})
    }
  }, [])
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d")
    if (!element || !ctx) return
    const motion = matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0,
      previous = 0,
      lastHud = 0,
      lastEvent = 0
    let oldPhase = game.current.phase
    const resize = () => {
      const bounds = element.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio || 1, 2)
      element.width = Math.max(1, Math.round(bounds.width * ratio))
      element.height = Math.max(1, Math.round(bounds.height * ratio))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    const animate = (now: number) => {
      const g = game.current,
        controls = input.current
      const down = (code: string) => controls.keys.has(code) || controls.touches.has(code)
      if (activeRef.current && !document.hidden && screenRef.current === "game") {
        stepBrickbreaker(
          g,
          {
            move: Number(down("ArrowRight") || down("KeyD")) - Number(down("ArrowLeft") || down("KeyA")),
            target: controls.target,
            aim: Number(down("ArrowUp")) - Number(down("ArrowDown")),
            fire: controls.shot || down("Space"),
          },
          previous ? (now - previous) / 1000 : 1 / 60,
        )
        controls.shot = false
      }
      previous = now
      if (g.phase !== oldPhase) {
        if (["cleared", "won", "over"].includes(g.phase) && !g.practice) {
          const p = progress.current
          p.currentLevel = g.level
          p.highScores[g.level] = Math.max(p.highScores[g.level] || 0, g.score - stageStartScore.current)
          if (g.phase === "cleared" && !p.unlockedLevels.includes(g.level + 1)) p.unlockedLevels.push(g.level + 1)
          if (g.phase === "won" || g.phase === "over") {
            p.gamesPlayed++
            p.totalScore += g.score
          }
          saveGameProgress("brickbreaker", p)
          setBest((value) => {
            const nextBest = Math.max(value, g.score)
            writeGameStorage("brickbreaker_circuit_best", String(nextBest))
            return nextBest
          })
        }
        oldPhase = g.phase
        publish()
      }
      if (lastEvent !== g.event) {
        lastEvent = g.event
        const ac = audio.current
        if (soundOn.current && activeRef.current && ac?.state === "running") {
          const oscillator = ac.createOscillator(),
            gain = ac.createGain()
          oscillator.type = "triangle"
          const frequency = { brick: 440, paddle: 180, pickup: 720, loss: 100, clear: 880, fire: 320 }[g.sound]
          oscillator.frequency.setValueAtTime(frequency, ac.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.65, ac.currentTime + 0.08)
          gain.gain.setValueAtTime(0.035, ac.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09)
          oscillator.connect(gain)
          gain.connect(ac.destination)
          oscillator.start()
          oscillator.stop(ac.currentTime + 0.1)
          oscillator.onended = () => {
            oscillator.disconnect()
            gain.disconnect()
          }
        }
      }
      if (now - lastHud > 100) {
        publish()
        lastHud = now
      }
      if (activeRef.current) drawBrickbreaker(ctx, g, motion.matches)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [publish])
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        !activeRef.current ||
        screenRef.current !== "game" ||
        (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))
      )
        return
      if (["Escape", "KeyP"].includes(event.code)) {
        event.preventDefault()
        event.stopPropagation()
        if (event.repeat) return
        const g = game.current
        if (["playing", "serve"].includes(g.phase)) {
          pauseBrickbreaker(g, !g.paused)
          clearInput()
          publish()
        }
        return
      }
      if (!["playing", "serve"].includes(game.current.phase) || game.current.paused) return
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "Space"].includes(event.code)) {
        if (event.code === "Space" && event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        input.current.keys.add(event.code)
        if (event.code !== "Space") input.current.target = undefined
      }
    }
    const up = (event: KeyboardEvent) => input.current.keys.delete(event.code)
    const hidden = () => {
      if (document.hidden) pause()
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", pause)
    document.addEventListener("visibilitychange", hidden)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", pause)
      document.removeEventListener("visibilitychange", hidden)
    }
  }, [pause, clearInput, publish])
  const playable = screen === "game" && !hud.paused && ["playing", "serve"].includes(hud.phase)
  const steer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!playable || (event.pointerType !== "mouse" && !event.buttons)) return
    const box = event.currentTarget.getBoundingClientRect()
    input.current.target = ((event.clientX - box.left) / box.width) * FIELD.width
  }
  const heldButton = (code: string) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!playable) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      input.current.touches.add(code)
      input.current.target = undefined
      if (code === "Space") input.current.shot = true
    },
    onPointerUp: () => input.current.touches.delete(code),
    onPointerCancel: () => input.current.touches.delete(code),
    onLostPointerCapture: () => input.current.touches.delete(code),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 && playable) {
        if (code === "Space") input.current.shot = true
        else input.current.target = game.current.paddle + (code === "ArrowLeft" ? -24 : 24)
      }
    },
  })
  const powerText = (Object.entries(hud.powers) as [keyof typeof hud.powers, number][])
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${PICKUPS[key].label} ${Math.ceil(value)}s`)
    .join(" · ")
  const ended = hud.phase === "over" || hud.phase === "won"
  const overlay = screen !== "game" || hud.phase === "ready" || hud.paused || ended || hud.phase === "cleared"
  return (
    <section className="bb-cabinet" aria-label="Brickbreaker arcade">
      <header className="bb-heading">
        <div>
          <h2>BRICKBREAKER</h2>
          <span>BlackBerry-inspired · 34 original circuits</span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            type="button"
            style={button}
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute game sounds" : "Enable game sounds"}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            style={button}
            disabled={!["serve", "playing"].includes(hud.phase)}
            onClick={hud.paused ? resume : pause}
            aria-label={hud.paused ? "Resume Brickbreaker" : "Pause Brickbreaker"}
            aria-keyshortcuts="P Escape"
          >
            {hud.paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
      </header>
      <div className="bb-console">
        <div className="bb-instruments" aria-label="Game status">
          <div>
            <span>Score</span>
            <strong data-bb-score>{hud.score.toLocaleString()}</strong>
            <small>Best {best.toLocaleString()}</small>
          </div>
          <div>
            <span>Lives / rockets</span>
            <strong>
              <span style={{ color: "#9bbcff" }}>{hud.lives}</span>
              <span style={{ fontSize: 14, color: "#acb7c5", margin: "0 10px" }}>/</span>
              <span style={{ color: "#e5c185" }}>{hud.rockets}</span>
            </strong>
            <small>
              Level {hud.level} / {BRICK_LEVELS.length}
            </small>
          </div>
        </div>
        <div className="bb-field-frame">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label="Brickbreaker playfield. Arrows or A and D move. Space launches or fires. P pauses."
            onPointerDown={(event) => {
              if (!playable) return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.setPointerCapture(event.pointerId)
              const box = event.currentTarget.getBoundingClientRect()
              input.current.target = ((event.clientX - box.left) / box.width) * FIELD.width
            }}
            onPointerMove={steer}
            onPointerCancel={() => {
              input.current.target = undefined
            }}
          />
          {overlay && (
            <div className="bb-overlay" role="region" aria-label="Brickbreaker menu">
              {screen === "scores" ? (
                <Leaderboard gameName="brickbreaker" onClose={() => setScreen("game")} />
              ) : screen === "help" ? (
                <>
                  <h3>Make the angle.</h3>
                  <p>
                    The paddle’s edges send the ball sideways. The center sends it higher. Silver blocks stay; clear
                    every red brick.
                  </p>
                  <p>
                    Move with ← → / A D, point on the field, or drag the strip below it. ↑ ↓ adjusts your launch angle.
                    Space / Fire launches the ball and fires weapons. P / Esc pauses.
                  </p>
                  <div className="bb-pickup-guide">
                    {Object.entries(PICKUPS).map(([key, value]) => (
                      <div key={key}>
                        <b style={{ background: value.color }}>{value.glyph}</b>
                        <span>
                          <strong>{value.label}</strong>
                          <br />
                          {value.help}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button style={primary} onClick={() => setScreen("game")}>
                    Back to game
                  </button>
                </>
              ) : screen === "levels" ? (
                <>
                  <h3>Practice a circuit</h3>
                  <p>
                    Campaign clears unlock boards. Practice starts with three lives and has no public score submission.
                  </p>
                  <div className="bb-levels">
                    {BRICK_LEVELS.map(([name], i) => (
                      <button
                        key={name}
                        style={button}
                        disabled={!progress.current.unlockedLevels.includes(i + 1)}
                        aria-label={`Practice level ${i + 1}: ${name}`}
                        onClick={() => start(i + 1, true)}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button style={button} onClick={() => setScreen("game")}>
                    Back
                  </button>
                </>
              ) : hud.phase === "ready" ? (
                <>
                  <span className="bb-model">HANDHELD CLASSIC / REBUILT</span>
                  <h3>One more board.</h3>
                  <p>
                    Steel, red bricks, a blue paddle.
                    <br />
                    Find the angle. Catch the capsules.
                  </p>
                  <button style={{ ...primary, width: "100%" }} onClick={() => start()}>
                    <Play size={16} /> Start campaign
                  </button>
                  <div className="bb-menu-row">
                    <button style={button} onClick={() => openScreen("levels")}>
                      Practice
                    </button>
                    <button style={button} onClick={() => openScreen("scores")}>
                      High scores
                    </button>
                    <button style={button} onClick={() => openScreen("help")}>
                      How to play
                    </button>
                  </div>
                  <small>Arrows / mouse / touch · Space to launch</small>
                </>
              ) : ended ? (
                <>
                  <h3>{hud.phase === "won" ? "All 34. Nicely done." : "Out of paddles."}</h3>
                  <p>
                    {hud.score.toLocaleString()} points · Level {hud.level}
                  </p>
                  {hud.practice ? (
                    <p>Practice run · scores stay off the public board.</p>
                  ) : (
                    <ScoreEntry key={runId.current} gameName="brickbreaker" score={hud.score} level={hud.level} />
                  )}
                  <div className="bb-menu-row">
                    <button style={primary} onClick={() => start(hud.practice ? hud.level : 1, hud.practice)}>
                      <RotateCcw size={14} /> Play again
                    </button>
                    <button style={button} onClick={menu}>
                      Menu
                    </button>
                  </div>
                </>
              ) : hud.phase === "cleared" ? (
                <>
                  <h3>Circuit {hud.level} cleared.</h3>
                  <p>
                    {BRICK_LEVELS[hud.level - 1][0]}
                    <br />
                    {hud.score.toLocaleString()} points · {hud.lives} lives left
                  </p>
                  <button style={primary} onClick={next}>
                    Next circuit →
                  </button>
                  <button style={button} onClick={menu}>
                    Back to menu
                  </button>
                </>
              ) : (
                <>
                  <h3>Paused.</h3>
                  <p>Your ball, power-ups and score are held right here.</p>
                  <button style={primary} onClick={resume}>
                    <Play size={15} /> Resume
                  </button>
                  <div className="bb-menu-row">
                    <button style={button} onClick={() => start(hud.practice ? hud.level : 1, hud.practice)}>
                      <RotateCcw size={14} /> Restart run
                    </button>
                    <button style={button} onClick={() => setScreen("help")}>
                      Controls
                    </button>
                    <button style={button} onClick={menu}>
                      <X size={14} /> Menu
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="bb-deck">
          <div className="bb-stage-label">
            {hud.practice ? "PRACTICE · " : ""}
            {String(hud.level).padStart(2, "0")} / {BRICK_LEVELS[hud.level - 1][0]}
          </div>
          <div
            className="bb-touch-strip"
            role="slider"
            aria-label="Paddle position"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(game.current.paddle)}
            tabIndex={playable ? 0 : -1}
            onKeyDown={(event) => {
              if (["ArrowLeft", "ArrowRight"].includes(event.key) && playable) {
                event.preventDefault()
                event.stopPropagation()
                input.current.target = game.current.paddle + (event.key === "ArrowLeft" ? -20 : 20)
              }
            }}
            onPointerDown={(event) => {
              if (!playable) return
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = { id: event.pointerId, x: event.clientX, paddle: game.current.paddle }
            }}
            onPointerMove={(event) => {
              if (!playable || drag.current?.id !== event.pointerId) return
              const width = event.currentTarget.getBoundingClientRect().width
              input.current.target = drag.current.paddle + ((event.clientX - drag.current.x) * FIELD.width) / width
            }}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
            onLostPointerCapture={() => {
              drag.current = null
            }}
          >
            <span>‹</span>
            <span>Slide to steer</span>
            <span>›</span>
          </div>
          <div className="bb-play-controls">
            <button
              style={button}
              disabled={!playable}
              aria-label="Move paddle left"
              aria-keyshortcuts="ArrowLeft A"
              {...heldButton("ArrowLeft")}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              style={primary}
              disabled={!playable}
              aria-label="Launch or fire"
              aria-keyshortcuts="Space"
              {...heldButton("Space")}
            >
              {hud.held ? "Launch" : "Fire"} <kbd>Space</kbd>
            </button>
            <button
              style={button}
              disabled={!playable}
              aria-label="Move paddle right"
              aria-keyshortcuts="ArrowRight D"
              {...heldButton("ArrowRight")}
            >
              <ArrowRight size={18} />
            </button>
          </div>
          {hud.held && playable && (
            <label className="bb-aim">
              Aim{" "}
              <input
                aria-label="Launch angle"
                type="range"
                min={-100}
                max={100}
                value={Math.round(hud.aim * 100)}
                onChange={(event) => {
                  game.current.aim = Number(event.target.value) / 100
                }}
              />
              <span>↑ ↓</span>
            </label>
          )}
          <div className="bb-status" role="status" aria-live="polite">
            {hud.message ||
              (hud.paused
                ? "Paused · P to resume"
                : hud.phase === "serve"
                  ? "Aim first. Space / Launch when ready."
                  : "Catch capsules. Keep the ball alive.")}
          </div>
          {powerText && <div className="bb-powers">{powerText}</div>}
        </div>
      </div>
    </section>
  )
}
