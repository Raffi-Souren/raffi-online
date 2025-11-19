"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Position {
  x: number
  y: number
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type GameState = "START" | "PLAYING" | "GAME_OVER"

const GRID_SIZE = 20
const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 400

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>("START")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [snake, setSnake] = useState<Position[]>([{ x: 200, y: 200 }])
  const [food, setFood] = useState<Position>({ x: 100, y: 100 })
  const [direction, setDirection] = useState<Direction>("RIGHT")
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem("snake-high-score")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore))
    }
  }, [])

  // Generate random food position
  const generateFood = useCallback((): Position => {
    return {
      x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)) * GRID_SIZE,
      y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)) * GRID_SIZE,
    }
  }, [])

  // Start game
  const startGame = useCallback(
    (initialDirection: Direction = "RIGHT") => {
      setGameState("PLAYING")
      setScore(0)
      setSnake([{ x: 200, y: 200 }])
      setFood(generateFood())
      setDirection(initialDirection)
    },
    [generateFood],
  )

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === "START" || gameState === "GAME_OVER") {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(e.key)) {
          e.preventDefault()
          startGame()
        }
      } else if (gameState === "PLAYING") {
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
  }, [gameState, direction, startGame])

  // Touch controls (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    }

    const dx = touchEnd.x - touchStartRef.current.x
    const dy = touchEnd.y - touchStartRef.current.y

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe
      if (Math.abs(dx) > 30) { // Threshold
        if (dx > 0 && direction !== "LEFT") setDirection("RIGHT")
        else if (dx < 0 && direction !== "RIGHT") setDirection("LEFT")
      }
    } else {
      // Vertical swipe
      if (Math.abs(dy) > 30) {
        if (dy > 0 && direction !== "UP") setDirection("DOWN")
        else if (dy < 0 && direction !== "DOWN") setDirection("UP")
      }
    }
    
    // Tap to start
    if (gameState !== "PLAYING" && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      startGame()
    }

    touchStartRef.current = null
  }

  // Game loop
  useEffect(() => {
    if (gameState !== "PLAYING") return

    gameLoopRef.current = setInterval(() => {
      setSnake((currentSnake) => {
        const newSnake = [...currentSnake]
        const head = { ...newSnake[0] }

        // Move head
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

        // Check wall collision
        if (head.x < 0 || head.x >= CANVAS_WIDTH || head.y < 0 || head.y >= CANVAS_HEIGHT) {
          setGameState("GAME_OVER")
          return currentSnake
        }

        // Check self collision
        if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
          setGameState("GAME_OVER")
          return currentSnake
        }

        newSnake.unshift(head)

        // Check food collision
        if (head.x === food.x && head.y === food.y) {
          setScore((prev) => prev + 10)
          setFood(generateFood())
        } else {
          newSnake.pop()
        }

        return newSnake
      })
    }, 100) // Slightly faster

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, direction, food, generateFood])

  // Update high score
  useEffect(() => {
    if (gameState === "GAME_OVER" && score > highScore) {
      setHighScore(score)
      localStorage.setItem("snake-high-score", score.toString())
    }
  }, [gameState, score, highScore])

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas - Nokia Green Background
    ctx.fillStyle = "#9BBB58"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid dots (subtle)
    ctx.fillStyle = "#8DAA4B"
    for(let i=0; i<CANVAS_WIDTH; i+=GRID_SIZE) {
      for(let j=0; j<CANVAS_HEIGHT; j+=GRID_SIZE) {
        ctx.fillRect(i, j, 1, 1)
      }
    }

    if (gameState === "START") {
      ctx.fillStyle = "#000"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("SNAKE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
      ctx.font = "16px monospace"
      ctx.fillText("Swipe or Arrows to Move", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText("Tap to Start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30)
    } else if (gameState === "GAME_OVER") {
      ctx.fillStyle = "#000"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
      ctx.font = "16px monospace"
      ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText(`High: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
      ctx.fillText("Tap to Play Again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
    } else {
      // Draw snake
      ctx.fillStyle = "#000"
      snake.forEach((segment) => {
        ctx.fillRect(segment.x, segment.y, GRID_SIZE - 1, GRID_SIZE - 1)
      })

      // Draw food
      ctx.fillStyle = "#000"
      ctx.beginPath()
      ctx.arc(food.x + GRID_SIZE/2, food.y + GRID_SIZE/2, GRID_SIZE/2 - 2, 0, Math.PI*2)
      ctx.fill()
    }

    // Draw score
    ctx.fillStyle = "#000"
    ctx.font = "16px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`${score}`, 10, 25)
  }, [gameState, snake, food, score, highScore])

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
      <div className="relative w-full aspect-square bg-[#9BBB58] border-8 border-gray-800 rounded-xl shadow-xl overflow-hidden">
        {/* Screen Bezel Effect */}
        <div className="absolute inset-0 border-4 border-[#8DAA4B]/50 pointer-events-none z-10 rounded-lg"></div>
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      <div className="text-sm text-gray-600 font-mono text-center">
        <span className="hidden md:inline">Use Arrow Keys to Move</span>
        <span className="md:hidden">Swipe to Change Direction</span>
      </div>
    </div>
  )
}
