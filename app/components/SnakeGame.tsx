"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import Leaderboard from "./Leaderboard"
import GameOverScreen from "./GameOverScreen"
import GameControls from "./GameControls"
import { SNAKE_LEVELS, loadGameProgress, saveGameProgress, type GameProgress } from "@/lib/game-utils"

interface Position {
  x: number
  y: number
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type GameView = "menu" | "playing" | "paused" | "gameover" | "leaderboard"

const GRID_SIZE = 20
const CANVAS_SIZE = 400

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameView, setGameView] = useState<GameView>("menu")
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScore] = useState(0)
  const [snake, setSnake] = useState<Position[]>([{ x: 200, y: 200 }])
  const [food, setFood] = useState<Position>({ x: 100, y: 100 })
  const [obstacles, setObstacles] = useState<Position[]>([])
  const [direction, setDirection] = useState<Direction>("RIGHT")
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [progress, setProgress] = useState<GameProgress | null>(null)

  const gameLoopRef = useRef<NodeJS.Timeout>()
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Load progress
  useEffect(() => {
    setProgress(loadGameProgress("snake"))
    const savedHighScore = localStorage.getItem("snake-high-score")
    if (savedHighScore) setHighScore(Number.parseInt(savedHighScore))
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

  const generateFood = useCallback((currentSnake: Position[], currentObstacles: Position[]): Position => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
        y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
      }
    } while (
      currentSnake.some((s) => s.x === newFood.x && s.y === newFood.y) ||
      currentObstacles.some((o) => o.x === newFood.x && o.y === newFood.y)
    )
    return newFood
  }, [])

  const generateObstacles = useCallback((count: number, currentSnake: Position[]): Position[] => {
    const obs: Position[] = []
    for (let i = 0; i < count; i++) {
      let pos: Position
      do {
        pos = {
          x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
          y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
        }
      } while (
        currentSnake.some((s) => Math.abs(s.x - pos.x) < GRID_SIZE * 3 && Math.abs(s.y - pos.y) < GRID_SIZE * 3) ||
        obs.some((o) => o.x === pos.x && o.y === pos.y)
      )
      obs.push(pos)
    }
    return obs
  }, [])

  const startGame = useCallback(() => {
    const config = getLevelConfig(1)
    const initialSnake = [{ x: 200, y: 200 }]
    const initialObstacles = generateObstacles(config.obstacles, initialSnake)

    setGameView("playing")
    setScore(0)
    setLevel(1)
    setSnake(initialSnake)
    setFood(generateFood(initialSnake, initialObstacles))
    setObstacles(initialObstacles)
    setDirection("RIGHT")
    setTimeElapsed(0)
  }, [generateFood, generateObstacles])

  // Update level based on score
  useEffect(() => {
    if (gameView !== "playing") return

    const newLevel = SNAKE_LEVELS.findIndex((l) => score < l.requiredScore)
    const actualLevel = newLevel === -1 ? SNAKE_LEVELS.length : Math.max(1, newLevel)

    if (actualLevel !== level) {
      setLevel(actualLevel)
      const config = getLevelConfig(actualLevel)
      setObstacles(generateObstacles(config.obstacles, snake))
    }
  }, [score, level, gameView, snake, generateObstacles])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
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
            if (direction !== "DOWN") setDirection("UP")
            break
          case "ArrowDown":
          case "s":
            e.preventDefault()
            if (direction !== "UP") setDirection("DOWN")
            break
          case "ArrowLeft":
          case "a":
            e.preventDefault()
            if (direction !== "RIGHT") setDirection("LEFT")
            break
          case "ArrowRight":
          case "d":
            e.preventDefault()
            if (direction !== "LEFT") setDirection("RIGHT")
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameView, direction, startGame])

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
        if (dx > 30 && direction !== "LEFT") setDirection("RIGHT")
        else if (dx < -30 && direction !== "RIGHT") setDirection("LEFT")
      } else {
        if (dy > 30 && direction !== "UP") setDirection("DOWN")
        else if (dy < -30 && direction !== "DOWN") setDirection("UP")
      }
    }

    touchStartRef.current = null
  }

  // Game loop
  useEffect(() => {
    if (gameView !== "playing") return

    const config = getLevelConfig(level)

    gameLoopRef.current = setInterval(() => {
      setSnake((currentSnake) => {
        const newSnake = [...currentSnake]
        const head = { ...newSnake[0] }

        switch (direction) {
          case "UP":
            head.y -= GRID_SIZE
            break
          case "DOWN":
            head.y += GRID_SIZE
            break
          case "LEFT":
            head.x -= GRID_SIZE
            break
          case "RIGHT":
            head.x += GRID_SIZE
            break
        }

        // Wall collision
        if (head.x < 0 || head.x >= CANVAS_SIZE || head.y < 0 || head.y >= CANVAS_SIZE) {
          handleGameOver()
          return currentSnake
        }

        // Self collision
        if (newSnake.some((s) => s.x === head.x && s.y === head.y)) {
          handleGameOver()
          return currentSnake
        }

        // Obstacle collision
        if (obstacles.some((o) => o.x === head.x && o.y === head.y)) {
          handleGameOver()
          return currentSnake
        }

        newSnake.unshift(head)

        // Food collision
        if (head.x === food.x && head.y === food.y) {
          const points = 10 * level
          setScore((prev) => prev + points)
          setFood(generateFood(newSnake, obstacles))
        } else {
          newSnake.pop()
        }

        return newSnake
      })
    }, config.speed)

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    }
  }, [gameView, direction, food, level, obstacles, generateFood])

  const handleGameOver = useCallback(() => {
    setGameView("gameover")

    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem("snake-high-score", score.toString())
    }

    if (progress) {
      const newProgress = { ...progress }
      newProgress.highScores[level] = Math.max(newProgress.highScores[level] || 0, score)
      newProgress.totalScore += score
      newProgress.gamesPlayed += 1
      saveGameProgress("snake", newProgress)
      setProgress(newProgress)
    }
  }, [score, highScore, level, progress])

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

  const isHighScore = score > highScore

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
          <div className="absolute inset-0 flex items-center justify-center rounded-xl">
            <GameOverScreen
              score={score}
              level={level}
              isHighScore={isHighScore}
              gameName="snake"
              onRestart={startGame}
              onQuit={() => setGameView("menu")}
              onViewLeaderboard={() => setGameView("leaderboard")}
              stats={{ timeElapsed }}
            />
          </div>
        )}

        {gameView === "leaderboard" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl overflow-auto">
            <Leaderboard
              gameName="snake"
              currentScore={score > 0 ? score : undefined}
              onClose={() => setGameView("menu")}
            />
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600 font-mono text-center">
        <span className="hidden md:inline">Arrow Keys to Move • Level up every 100 pts</span>
        <span className="md:hidden">Swipe to Move</span>
      </div>
    </div>
  )
}
