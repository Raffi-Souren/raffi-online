"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import Leaderboard from "./Leaderboard"
import GameOverScreen from "./GameOverScreen"
import GameControls from "./GameControls"
import { PARACHUTE_LEVELS, loadGameProgress, saveGameProgress, type GameProgress } from "@/lib/game-utils"

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
const PLAYER_SIZE = 14
const HELICOPTER_WIDTH = 32
const HELICOPTER_HEIGHT = 14
const MISSILE_SIZE = 8
const GROUND_Y = CANVAS_HEIGHT - 45

export default function ParachuteGame() {
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
  const [progress, setProgress] = useState<GameProgress | null>(null)

  const [keys, setKeys] = useState<Record<string, boolean>>({})
  const [mobileControls, setMobileControls] = useState({ left: false, right: false })
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const helicopterSpawnRef = useRef<NodeJS.Timeout>()

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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameView === "menu" || gameView === "gameover") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          if (gameView === "menu") startGame()
        }
        return
      }
      if (e.key === "Escape" && gameView === "playing") {
        setGameView("paused")
        return
      }
      setKeys((prev) => ({ ...prev, [e.key]: true }))
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key]: false }))
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameView, startGame])

  // Touch controls
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (gameView !== "playing") {
        if (gameView === "menu") startGame()
        return
      }
      const rect = e.currentTarget.getBoundingClientRect()
      const touchX = e.touches[0].clientX - rect.left
      setMobileControls({ left: touchX < rect.width / 2, right: touchX >= rect.width / 2 })
    },
    [gameView, startGame],
  )

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setMobileControls({ left: false, right: false })
  }, [])

  // Spawn helicopters
  useEffect(() => {
    if (gameView !== "playing") return
    const config = getLevelConfig(level)

    helicopterSpawnRef.current = setInterval(() => {
      setHelicopters((prev) => [
        ...prev,
        {
          x: Math.random() < 0.5 ? -HELICOPTER_WIDTH : CANVAS_WIDTH + HELICOPTER_WIDTH,
          y: Math.random() * 120 + 40,
          direction: Math.random() < 0.5 ? 1 : -1,
        },
      ])
    }, config.spawnRate)

    return () => {
      if (helicopterSpawnRef.current) clearInterval(helicopterSpawnRef.current)
    }
  }, [gameView, level])

  const handleGameOver = useCallback(() => {
    setGameView("gameover")
    if (progress) {
      const newProgress = { ...progress }
      newProgress.highScores[level] = Math.max(newProgress.highScores[level] || 0, score)
      newProgress.totalScore += score
      newProgress.gamesPlayed += 1
      saveGameProgress("parachute", newProgress)
      setProgress(newProgress)
    }
  }, [score, level, progress])

  // Game loop
  useEffect(() => {
    if (gameView !== "playing") return
    const config = getLevelConfig(level)

    gameLoopRef.current = setInterval(() => {
      // Move player
      setPlayer((prev) => {
        let newX = prev.x
        const newY = prev.y + 2.5

        if (keys["ArrowLeft"] || mobileControls.left) newX -= 4
        if (keys["ArrowRight"] || mobileControls.right) newX += 4
        newX = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, newX))

        if (newY >= GROUND_Y - PLAYER_SIZE) {
          const points = 10 + level * 5
          setScore((s) => s + points)
          setLandings((l) => l + 1)
          return { x: CANVAS_WIDTH / 2, y: 50 }
        }
        return { x: newX, y: newY }
      })

      // Move helicopters
      setHelicopters((prev) => {
        const newHelis = prev
          .map((h) => ({ ...h, x: h.x + h.direction * config.heliSpeed }))
          .filter((h) => h.x > -60 && h.x < CANVAS_WIDTH + 60)

        newHelis.forEach((h) => {
          if (Math.random() < 0.025 + level * 0.005) {
            setMissiles((m) => [...m, { x: h.x + HELICOPTER_WIDTH / 2, y: h.y + HELICOPTER_HEIGHT }])
          }
        })
        return newHelis
      })

      // Move missiles
      setMissiles((prev) =>
        prev.map((m) => ({ ...m, y: m.y + config.missileSpeed })).filter((m) => m.y < CANVAS_HEIGHT),
      )

      // Check collisions
      setMissiles((prevMissiles) => {
        return prevMissiles.filter((missile) => {
          const hit =
            missile.x < player.x + PLAYER_SIZE &&
            missile.x + MISSILE_SIZE > player.x - PLAYER_SIZE &&
            missile.y < player.y + PLAYER_SIZE &&
            missile.y + MISSILE_SIZE > player.y - PLAYER_SIZE

          if (hit) {
            setLives((prev) => {
              const newLives = prev - 1
              if (newLives <= 0) handleGameOver()
              return newLives
            })
            setPlayer({ x: CANVAS_WIDTH / 2, y: 50 })
            return false
          }
          return true
        })
      })
    }, 16)

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    }
  }, [gameView, keys, mobileControls, player, level, handleGameOver])

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

  const isHighScore = progress ? score > (progress.highScores[level] || 0) : false

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto px-2">
      {(gameView === "playing" || gameView === "paused") && (
        <GameControls
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
            onTouchEnd={handleTouchEnd}
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
          <div className="absolute inset-0 flex items-center justify-center rounded-lg">
            <GameOverScreen
              score={score}
              level={level}
              isHighScore={isHighScore}
              gameName="parachute"
              onRestart={startGame}
              onQuit={() => setGameView("menu")}
              onViewLeaderboard={() => setGameView("leaderboard")}
              stats={{ timeElapsed }}
            />
          </div>
        )}

        {gameView === "leaderboard" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-auto">
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

      <div className="text-sm text-gray-600 font-mono text-center">
        <span className="hidden md:inline">Arrow Keys to Steer • Space to Start</span>
        <span className="md:hidden">Tap Left/Right to Steer</span>
      </div>
    </div>
  )
}
