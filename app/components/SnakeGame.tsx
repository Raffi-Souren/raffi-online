"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import Leaderboard from "./Leaderboard"
import GameOverScreen from "./GameOverScreen"
import GameControls from "./GameControls"
import HandheldConsole from "../../components/ui/HandheldConsole"
import { useWindowActivity } from "../../components/ui/WindowShell"
import {
  SNAKE_LEVELS,
  loadGameProgress,
  saveGameProgress,
  readGameStorage,
  writeGameStorage,
  type GameProgress,
} from "@/lib/game-utils"
import {
  chooseSnakeFood,
  moveSnake,
  placeSnakeObstacles,
  queueSnakeTurn,
  type SnakeDirection,
} from "@/lib/handheld-engine"

interface Position {
  x: number
  y: number
}

type GameView = "menu" | "playing" | "paused" | "gameover" | "leaderboard"

const GRID_SIZE = 20
const CANVAS_SIZE = 400

export default function SnakeGame() {
  const { active } = useWindowActivity()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameView, setGameView] = useState<GameView>("menu")
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScore] = useState(0)
  const [snake, setSnake] = useState<Position[]>([{ x: 200, y: 200 }])
  const [food, setFood] = useState<Position>({ x: 100, y: 100 })
  const [obstacles, setObstacles] = useState<Position[]>([])
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [progress, setProgress] = useState<GameProgress | null>(null)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [boardCleared, setBoardCleared] = useState(false)

  const gameLoopRef = useRef<NodeJS.Timeout>()
  const snakeRef = useRef<Position[]>([{ x: 200, y: 200 }])
  const gameOverHandledRef = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const directionRef = useRef<SnakeDirection>("RIGHT")
  const turnsRef = useRef<SnakeDirection[]>([])
  const queueTurn = useCallback((next: SnakeDirection) => {
    turnsRef.current = queueSnakeTurn(directionRef.current, turnsRef.current, next)
  }, [])

  useEffect(() => {
    if (!active) setGameView((view) => (view === "playing" ? "paused" : view))
    const pause = () => setGameView((view) => (view === "playing" ? "paused" : view))
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

  // Load progress
  useEffect(() => {
    setProgress(loadGameProgress("snake"))
    const savedHighScore = Number(readGameStorage("snake-high-score"))
    if (Number.isFinite(savedHighScore) && savedHighScore > 0) setHighScore(savedHighScore)
  }, [])

  // Timer
  useEffect(() => {
    if (gameView !== "playing") return
    const timer = setInterval(() => setTimeElapsed((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [gameView])

  const getLevelConfig = (lvl: number) => {
    return SNAKE_LEVELS[Math.min(lvl - 1, SNAKE_LEVELS.length - 1)]
  }

  const startGame = useCallback(() => {
    const config = getLevelConfig(1)
    const initialSnake = [{ x: 200, y: 200 }]
    const initialObstacles = placeSnakeObstacles(config.obstacles, initialSnake)
    const initialFood = chooseSnakeFood(initialSnake, initialObstacles)
    if (!initialFood) return

    gameOverHandledRef.current = false
    snakeRef.current = initialSnake
    setGameView("playing")
    setScore(0)
    setLevel(1)
    setSnake(initialSnake)
    setFood(initialFood)
    setObstacles(initialObstacles)
    directionRef.current = "RIGHT"
    turnsRef.current = []
    setTimeElapsed(0)
    setIsNewHighScore(false)
    setBoardCleared(false)
  }, [])

  // Update level based on score
  useEffect(() => {
    if (gameView !== "playing") return

    const newLevel = SNAKE_LEVELS.findIndex((l) => score < l.requiredScore)
    const actualLevel = newLevel === -1 ? SNAKE_LEVELS.length : Math.max(1, newLevel)

    if (actualLevel !== level) {
      setLevel(actualLevel)
      const config = getLevelConfig(actualLevel)
      setObstacles(placeSnakeObstacles(config.obstacles, snake, food))
    }
  }, [score, level, gameView, snake, food])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return
      if (!active || (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return
      if (e.key === "Escape" && gameView === "paused") {
        e.preventDefault()
        setGameView("playing")
        return
      }
      if (gameView === "menu" || gameView === "gameover") {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(e.key)) {
          e.preventDefault()
          if (gameView === "menu") startGame()
        }
        return
      }

      if (gameView === "playing") {
        if (e.key === "Escape") {
          setGameView("paused")
          return
        }

        switch (e.key) {
          case "ArrowUp":
          case "w":
            e.preventDefault()
            queueTurn("UP")
            break
          case "ArrowDown":
          case "s":
            e.preventDefault()
            queueTurn("DOWN")
            break
          case "ArrowLeft":
          case "a":
            e.preventDefault()
            queueTurn("LEFT")
            break
          case "ArrowRight":
          case "d":
            e.preventDefault()
            queueTurn("RIGHT")
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameView, startGame, active, queueTurn])

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return

    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (gameView !== "playing") startGame()
      touchStartRef.current = null
      return
    }

    if (gameView === "playing") {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) queueTurn("RIGHT")
        else if (dx < -30) queueTurn("LEFT")
      } else {
        if (dy > 30) queueTurn("DOWN")
        else if (dy < -30) queueTurn("UP")
      }
    }

    touchStartRef.current = null
  }

  const handleGameOver = useCallback(
    (completed = false, finalScore = score) => {
      if (gameOverHandledRef.current) return
      gameOverHandledRef.current = true
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = undefined
      }

      const beatHighScore = finalScore > highScore
      setIsNewHighScore(beatHighScore)
      setBoardCleared(completed)
      setScore(finalScore)
      setGameView("gameover")

      if (beatHighScore) {
        setHighScore(finalScore)
        writeGameStorage("snake-high-score", finalScore.toString())
      }

      if (progress) {
        const newProgress: GameProgress = {
          ...progress,
          highScores: {
            ...progress.highScores,
            [level]: Math.max(progress.highScores[level] || 0, finalScore),
          },
          totalScore: progress.totalScore + finalScore,
          gamesPlayed: progress.gamesPlayed + 1,
        }
        saveGameProgress("snake", newProgress)
        setProgress(newProgress)
      }
    },
    [score, highScore, level, progress],
  )

  // Game loop
  useEffect(() => {
    if (gameView !== "playing") return

    const config = getLevelConfig(level)

    const interval = setInterval(() => {
      directionRef.current = turnsRef.current.shift() ?? directionRef.current
      const next = moveSnake(snakeRef.current, directionRef.current, food, obstacles, CANVAS_SIZE, GRID_SIZE)
      if (next.collision) {
        handleGameOver()
        return
      }
      snakeRef.current = next.snake
      setSnake(next.snake)
      if (next.grows) {
        const finalScore = score + 10 * level
        const nextFood = chooseSnakeFood(next.snake, obstacles)
        if (!nextFood) {
          handleGameOver(true, finalScore)
          return
        }
        setScore(finalScore)
        setFood(nextFood)
      }
    }, config.speed)
    gameLoopRef.current = interval

    return () => {
      clearInterval(interval)
      if (gameLoopRef.current === interval) gameLoopRef.current = undefined
    }
  }, [gameView, food, level, score, obstacles, handleGameOver])

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Background
    ctx.fillStyle = "#9BBB58"
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Grid
    ctx.fillStyle = "#8DAA4B"
    for (let i = 0; i < CANVAS_SIZE; i += GRID_SIZE) {
      for (let j = 0; j < CANVAS_SIZE; j += GRID_SIZE) {
        ctx.fillRect(i, j, 1, 1)
      }
    }

    if (gameView === "menu") {
      ctx.fillStyle = "#000"
      ctx.font = "bold 28px monospace"
      ctx.textAlign = "center"
      ctx.fillText("SNAKE", CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 60)
      ctx.font = "16px monospace"
      ctx.fillText("Swipe or Arrows to Move", CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 10)
      ctx.fillText("Tap to Start", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20)
      ctx.font = "14px monospace"
      ctx.fillText(`High Score: ${highScore}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 60)
    } else {
      // Draw obstacles
      ctx.fillStyle = "#654321"
      obstacles.forEach((o) => {
        ctx.fillRect(o.x + 2, o.y + 2, GRID_SIZE - 4, GRID_SIZE - 4)
      })

      // Draw snake
      snake.forEach((segment, i) => {
        ctx.fillStyle = i === 0 ? "#1a5c1a" : "#228B22"
        ctx.fillRect(segment.x + 1, segment.y + 1, GRID_SIZE - 2, GRID_SIZE - 2)
      })

      // Draw food
      ctx.fillStyle = "#FF0000"
      ctx.beginPath()
      ctx.arc(food.x + GRID_SIZE / 2, food.y + GRID_SIZE / 2, GRID_SIZE / 2 - 2, 0, Math.PI * 2)
      ctx.fill()

      // HUD
      ctx.fillStyle = "#000"
      ctx.font = "bold 14px monospace"
      ctx.textAlign = "left"
      ctx.fillText(`Score: ${score}`, 10, 22)
      ctx.textAlign = "right"
      ctx.fillText(`Level ${level}`, CANVAS_SIZE - 10, 22)
    }
  }, [gameView, snake, food, obstacles, score, level, highScore])

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
          timeElapsed={timeElapsed}
        />
      )}

      <HandheldConsole
        title="Snake"
        paused={gameView === "paused"}
        onStart={() => {
          if (gameView === "playing") setGameView("paused")
          else if (gameView === "paused") setGameView("playing")
          else startGame()
        }}
        onDirection={(next, held) => {
          if (!held || gameView !== "playing") return
          queueTurn(next)
        }}
      >
        <div className="relative w-full aspect-square max-w-[400px]">
          <div className="w-full h-full bg-[#9BBB58] border-4 border-gray-800 rounded-xl shadow-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="w-full h-full"
              style={{ imageRendering: "pixelated", touchAction: "none" }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => gameView === "menu" && startGame()}
            />
          </div>

          {gameView === "paused" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold mb-2">PAUSED</h2>
                <p className="text-sm text-gray-300">Press ESC or Resume</p>
              </div>
            </div>
          )}

          {gameView === "gameover" && (
            <div
              className="rounded-xl"
              style={{ position: "absolute", inset: 0, overflowY: "auto", overscrollBehavior: "contain" }}
            >
              <GameOverScreen
                score={score}
                level={level}
                isHighScore={isNewHighScore}
                gameName="snake"
                completed={boardCleared}
                onRestart={startGame}
                onQuit={() => setGameView("menu")}
                onViewLeaderboard={() => setGameView("leaderboard")}
                stats={{ timeElapsed }}
              />
            </div>
          )}

          {gameView === "leaderboard" && (
            <div
              className="rounded-xl"
              style={{ position: "absolute", inset: 0, overflowY: "auto", overscrollBehavior: "contain" }}
            >
              <Leaderboard
                gameName="snake"
                currentScore={score > 0 ? score : undefined}
                onClose={() => setGameView("menu")}
              />
            </div>
          )}
        </div>
      </HandheldConsole>

      <div className="text-sm text-gray-600 font-mono text-center">
        <span className="hidden md:inline">Arrow Keys to Move • Level up every 100 pts</span>
        <span className="md:hidden">Swipe to Move</span>
      </div>
    </div>
  )
}
