"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import Leaderboard from "./Leaderboard"
import GameOverScreen from "./GameOverScreen"
import GameControls from "./GameControls"
import { useGameControlMode } from "../../components/ui/GameControlChoice"
import HandheldConsole from "../../components/ui/HandheldConsole"
import { useWindowActivity } from "../../components/ui/WindowShell"
import { PARACHUTE_LEVELS, loadGameProgress, saveGameProgress, type GameProgress } from "@/lib/game-utils"
import { createParachute, stepParachute } from "@/lib/handheld-engine"

interface Position {
  x: number
  y: number
}
interface Helicopter {
  x: number
  y: number
  direction: number
}
interface Missile {
  x: number
  y: number
}

type GameView = "menu" | "playing" | "paused" | "gameover" | "leaderboard"

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 500
// The compact pause bar (68px) plus the 12px gap under it.
const PLAY_BAR_HEIGHT = 80
const PLAYER_SIZE = 14
const HELICOPTER_WIDTH = 32
const HELICOPTER_HEIGHT = 14
const MISSILE_SIZE = 8
const GROUND_Y = CANVAS_HEIGHT - 45

export default function ParachuteGame() {
  const { active } = useWindowActivity()
  const [controlMode, setControlMode] = useGameControlMode("parachute")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameView, setGameView] = useState<GameView>("menu")
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [player, setPlayer] = useState<Position>({ x: CANVAS_WIDTH / 2, y: 50 })
  const [helicopters, setHelicopters] = useState<Helicopter[]>([])
  const [missiles, setMissiles] = useState<Missile[]>([])
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [landings, setLandings] = useState(0)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [progress, setProgress] = useState<GameProgress | null>(null)

  const keysRef = useRef(new Set<string>())
  const stickRef = useRef(0)
  const touchRef = useRef({ left: false, right: false })
  const [mobileControls, setMobileControls] = useState({ left: false, right: false })
  const simulationRef = useRef(createParachute())
  const gameOverHandledRef = useRef(false)

  useEffect(() => {
    const pause = () => {
      keysRef.current.clear()
      stickRef.current = 0
      touchRef.current = { left: false, right: false }
      setMobileControls({ left: false, right: false })
      setGameView((view) => (view === "playing" ? "paused" : view))
    }
    if (!active) pause()
    const visibility = () => {
      if (document.hidden) pause()
    }
    window.addEventListener("blur", pause)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      window.removeEventListener("blur", pause)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [active])

  useEffect(() => {
    setProgress(loadGameProgress("parachute"))
  }, [])

  useEffect(() => {
    if (gameView !== "playing") return
    const timer = setInterval(() => setTimeElapsed((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [gameView])

  const getLevelConfig = (lvl: number) => {
    return PARACHUTE_LEVELS[Math.min(lvl - 1, PARACHUTE_LEVELS.length - 1)]
  }

  // Update level based on score
  useEffect(() => {
    if (gameView !== "playing") return
    const newLevel = PARACHUTE_LEVELS.findIndex((l) => score < l.requiredScore)
    const actualLevel = newLevel === -1 ? PARACHUTE_LEVELS.length : Math.max(1, newLevel)
    if (actualLevel !== level) setLevel(actualLevel)
  }, [score, level, gameView])

  const startGame = useCallback(() => {
    simulationRef.current = createParachute()
    gameOverHandledRef.current = false
    setIsNewHighScore(false)
    keysRef.current.clear()
    stickRef.current = 0
    touchRef.current = { left: false, right: false }
    setMobileControls({ left: false, right: false })
    setGameView("playing")
    setScore(0)
    setLevel(1)
    setLives(3)
    setPlayer({ x: CANVAS_WIDTH / 2, y: 50 })
    setHelicopters([])
    setMissiles([])
    setTimeElapsed(0)
    setLandings(0)
  }, [])

  useEffect(() => {
    if (gameView !== "playing") {
      keysRef.current.clear()
      stickRef.current = 0
      touchRef.current = { left: false, right: false }
      setMobileControls({ left: false, right: false })
    }
  }, [gameView])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return
      if (!active || (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return
      if (e.key === "Escape" && gameView === "paused") {
        e.preventDefault()
        setGameView("playing")
        return
      }
      if (gameView === "menu" || gameView === "gameover") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          if (gameView === "menu") startGame()
        }
        return
      }
      if (e.key === "Escape" && gameView === "playing") {
        e.preventDefault()
        setGameView("paused")
        return
      }
      if (gameView === "playing" && ["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) {
        e.preventDefault()
        keysRef.current.add(e.code)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameView, startGame, active])

  // Touch controls
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!active) return
      if (gameView !== "playing") {
        if (gameView === "menu") startGame()
        return
      }
      const rect = e.currentTarget.getBoundingClientRect()
      const touchX = e.touches[0].clientX - rect.left
      touchRef.current = { left: touchX < rect.width / 2, right: touchX >= rect.width / 2 }
      setMobileControls(touchRef.current)
    },
    [gameView, startGame, active],
  )

  const handleTouchEnd = useCallback(() => {
    touchRef.current = { left: false, right: false }
    setMobileControls(touchRef.current)
  }, [])

  const handleGameOver = useCallback(() => {
    if (gameOverHandledRef.current) return
    gameOverHandledRef.current = true
    const finalScore = simulationRef.current.score
    setScore(finalScore)
    setGameView("gameover")
    setIsNewHighScore(finalScore > (progress?.highScores[level] || 0))
    if (progress) {
      const newProgress = { ...progress, highScores: { ...progress.highScores } }
      newProgress.highScores[level] = Math.max(newProgress.highScores[level] || 0, finalScore)
      newProgress.totalScore += finalScore
      newProgress.gamesPlayed += 1
      saveGameProgress("parachute", newProgress)
      setProgress(newProgress)
    }
  }, [level, progress])

  // Update simulation outside React state setters, which may run twice in Strict Mode.
  useEffect(() => {
    if (gameView !== "playing" || !active) return
    const config = getLevelConfig(level)
    let frame = 0
    let previous = 0
    let accumulator = 0
    const animate = (now: number) => {
      accumulator += previous ? Math.min(now - previous, 80) : 16
      previous = now
      const state = simulationRef.current
      while (accumulator >= 16 && state.lives > 0) {
        const keys = keysRef.current
        const left = keys.has("ArrowLeft") || keys.has("KeyA") || touchRef.current.left
        const right = keys.has("ArrowRight") || keys.has("KeyD") || touchRef.current.right
        const movement = left || right ? Number(right) - Number(left) : stickRef.current
        stepParachute(state, Math.max(0, -movement), Math.max(0, movement), config)
        accumulator -= 16
      }
      setPlayer(state.player)
      setHelicopters(state.helicopters)
      setMissiles(state.missiles)
      setLives(state.lives)
      setScore(state.score)
      setLandings(state.landings)
      if (state.lives <= 0) handleGameOver()
      else frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [gameView, level, handleGameOver, active])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#87CEEB"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Ground
    ctx.fillStyle = "#228B22"
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)
    ctx.fillStyle = "#1a6b1a"
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 4)

    if (gameView === "menu") {
      ctx.fillStyle = "#000"
      ctx.font = "bold 28px monospace"
      ctx.textAlign = "center"
      ctx.fillText("PARACHUTE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
      ctx.font = "16px monospace"
      ctx.fillText("Avoid the missiles!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
      ctx.fillText("Land safely to score", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.font = "bold 18px monospace"
      ctx.fillText("TAP TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60)
    } else {
      // Draw parachute player
      ctx.fillStyle = "#FF4444"
      ctx.beginPath()
      ctx.arc(player.x, player.y - 15, 18, Math.PI, 0)
      ctx.fill()
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(player.x - 18, player.y - 15)
      ctx.lineTo(player.x, player.y)
      ctx.moveTo(player.x + 18, player.y - 15)
      ctx.lineTo(player.x, player.y)
      ctx.stroke()
      ctx.fillStyle = "#000"
      ctx.fillRect(player.x - PLAYER_SIZE / 2, player.y, PLAYER_SIZE, PLAYER_SIZE)

      // Helicopters
      helicopters.forEach((h) => {
        ctx.fillStyle = "#333"
        ctx.fillRect(h.x, h.y, HELICOPTER_WIDTH, HELICOPTER_HEIGHT)
        ctx.fillRect(h.x - 4, h.y - 3, HELICOPTER_WIDTH + 8, 3)
        ctx.fillRect(h.x + (h.direction === 1 ? -6 : HELICOPTER_WIDTH), h.y + 3, 8, 5)
      })

      // Missiles
      ctx.fillStyle = "#FF0000"
      missiles.forEach((m) => {
        ctx.beginPath()
        ctx.arc(m.x, m.y, MISSILE_SIZE / 2, 0, Math.PI * 2)
        ctx.fill()
      })

      // HUD
      ctx.fillStyle = "#000"
      ctx.font = "bold 16px monospace"
      ctx.textAlign = "left"
      ctx.fillText(`Score: ${score}`, 10, 25)
      ctx.fillText(`Lives: ${"❤️".repeat(Math.max(0, lives))}`, 10, 48)
      ctx.textAlign = "right"
      ctx.fillText(`Level ${level}`, CANVAS_WIDTH - 10, 25)
      ctx.fillText(`Landings: ${landings}`, CANVAS_WIDTH - 10, 48)
    }
  }, [gameView, player, helicopters, missiles, score, lives, level, landings])

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[760px] mx-auto px-2">
      {(gameView === "playing" || gameView === "paused") && (
        <GameControls
          compact
          isPaused={gameView === "paused"}
          onPause={() => setGameView("paused")}
          onResume={() => setGameView("playing")}
          onRestart={startGame}
          onQuit={() => setGameView("menu")}
          score={score}
          level={level}
          lives={lives}
          timeElapsed={timeElapsed}
        />
      )}

      <HandheldConsole
        screenAspect={CANVAS_WIDTH / CANVAS_HEIGHT}
        // Keep room for the pause bar so pressing START does not resize the console.
        reserveHeight={gameView === "playing" || gameView === "paused" ? 0 : PLAY_BAR_HEIGHT}
        title="Parachute"
        controlMode={controlMode}
        onControlModeChange={(mode) => {
          stickRef.current = 0
          touchRef.current = { left: false, right: false }
          setMobileControls(touchRef.current)
          setControlMode(mode)
        }}
        controlsDisabled={!active || gameView !== "playing"}
        onStick={({ x }) => {
          stickRef.current = active && gameView === "playing" ? x : 0
        }}
        horizontalOnly
        paused={gameView === "paused"}
        onStart={() => {
          if (gameView === "playing") setGameView("paused")
          else if (gameView === "paused") setGameView("playing")
          else startGame()
        }}
        onDirection={(direction, held) => {
          if (!active || gameView !== "playing") return
          if (direction === "LEFT" || direction === "RIGHT") {
            touchRef.current = { ...touchRef.current, [direction === "LEFT" ? "left" : "right"]: held }
            setMobileControls(touchRef.current)
          }
        }}
      >
        <div
          className="relative w-full"
          style={{ maxWidth: CANVAS_WIDTH, aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
        >
          <div className="w-full h-full border-4 border-gray-700 rounded-lg overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-full object-contain"
              style={{ touchAction: "none" }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchStart}
              aria-label="Parachute playfield. Use the movement stick, buttons, or hold either half to steer."
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onClick={() => gameView === "menu" && startGame()}
            />
          </div>

          {gameView === "paused" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold mb-2">PAUSED</h2>
                <p className="text-sm text-gray-300">Press ESC or Resume</p>
              </div>
            </div>
          )}

          {gameView === "gameover" && (
            <div
              className="rounded-lg"
              style={{ position: "absolute", inset: 0, overflowY: "auto", overscrollBehavior: "contain" }}
            >
              <GameOverScreen
                score={score}
                level={level}
                isHighScore={isNewHighScore}
                gameName="parachute"
                onRestart={startGame}
                onQuit={() => setGameView("menu")}
                onViewLeaderboard={() => setGameView("leaderboard")}
                stats={{ timeElapsed }}
              />
            </div>
          )}

          {gameView === "leaderboard" && (
            <div
              className="rounded-lg"
              style={{ position: "absolute", inset: 0, overflowY: "auto", overscrollBehavior: "contain" }}
            >
              <Leaderboard
                gameName="parachute"
                currentScore={score > 0 ? score : undefined}
                onClose={() => setGameView("menu")}
              />
            </div>
          )}

          {/* Mobile touch areas */}
          {gameView === "playing" && (
            <div className="absolute inset-0 pointer-events-none flex md:hidden">
              <div className={`w-1/2 h-full transition-opacity ${mobileControls.left ? "bg-white/10" : ""}`} />
              <div className={`w-1/2 h-full transition-opacity ${mobileControls.right ? "bg-white/10" : ""}`} />
            </div>
          )}
        </div>
      </HandheldConsole>

      <div className="text-sm text-gray-600 font-mono text-center">
        <span className="hidden md:inline">Arrows / A D to steer • Space to start</span>
        <span className="md:hidden">Stick, buttons or hold either half to steer</span>
      </div>
    </div>
  )
}
