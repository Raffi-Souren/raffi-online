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
    (initialDirection: Direction) => {
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
        // Start game with arrow keys
        switch (e.key) {
          case "ArrowUp":
          case "8":
          case "2":
            e.preventDefault()
            startGame("UP")
            break
          case "ArrowDown":
            e.preventDefault()
            startGame("DOWN")
            break
          case "ArrowLeft":
          case "4":
            e.preventDefault()
            startGame("LEFT")
            break
          case "ArrowRight":
          case "6":
            e.preventDefault()
            startGame("RIGHT")
            break
          case " ":
            e.preventDefault()
            startGame("RIGHT")
            break
        }
      } else if (gameState === "PLAYING") {
        // Control snake during game
        switch (e.key) {
          case "ArrowUp":
          case "8":
          case "2":
            e.preventDefault()
            if (direction !== "DOWN") setDirection("UP")
            break
          case "ArrowDown":
            e.preventDefault()
            if (direction !== "UP") setDirection("DOWN")
            break
          case "ArrowLeft":
          case "4":
            e.preventDefault()
            if (direction !== "RIGHT") setDirection("LEFT")
            break
          case "ArrowRight":
          case "6":
            e.preventDefault()
            if (direction !== "LEFT") setDirection("RIGHT")
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState, direction, startGame])

  // Mobile controls
  const handleMobileControl = (newDirection: Direction) => {
    if (gameState === "START" || gameState === "GAME_OVER") {
      startGame(newDirection)
    } else if (gameState === "PLAYING") {
      // Prevent reverse direction
      if (
        (newDirection === "UP" && direction !== "DOWN") ||
        (newDirection === "DOWN" && direction !== "UP") ||
        (newDirection === "LEFT" && direction !== "RIGHT") ||
        (newDirection === "RIGHT" && direction !== "LEFT")
      ) {
        setDirection(newDirection)
      }
    }
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
    }, 150)

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

    // Clear canvas
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (gameState === "START") {
      // Draw start screen
      ctx.fillStyle = "#0f0"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Snake", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

      ctx.font = "14px monospace"
      ctx.fillText("Press any arrow key to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText("Use keypad: 2↑ 4← 6→ 8↓", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
      ctx.fillText("Eat red food to grow!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
    } else if (gameState === "GAME_OVER") {
      // Draw game over screen
      ctx.fillStyle = "#f00"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

      ctx.fillStyle = "#fff"
      ctx.font = "16px monospace"
      ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)

      ctx.font = "14px monospace"
      ctx.fillText("Press any arrow key to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50)
    } else {
      // Draw snake
      ctx.fillStyle = "#0f0"
      snake.forEach((segment) => {
        ctx.fillRect(segment.x, segment.y, GRID_SIZE - 2, GRID_SIZE - 2)
      })

      // Draw food
      ctx.fillStyle = "#f00"
      ctx.fillRect(food.x, food.y, GRID_SIZE - 2, GRID_SIZE - 2)
    }

    // Draw score
    ctx.fillStyle = "#0f0"
    ctx.font = "16px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`Score: ${score}`, 10, 25)
    ctx.fillText(`High: ${highScore}`, 10, 45)
  }, [gameState, snake, food, score, highScore])

  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-400 bg-black"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Mobile Controls */}
      <div className="md:hidden">
        <div className="grid grid-cols-3 gap-2 w-48">
          <div></div>
          <button
            onTouchStart={() => handleMobileControl("UP")}
            onClick={() => handleMobileControl("UP")}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white p-3 rounded touch-manipulation"
          >
            ↑
          </button>
          <div></div>
          <button
            onTouchStart={() => handleMobileControl("LEFT")}
            onClick={() => handleMobileControl("LEFT")}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white p-3 rounded touch-manipulation"
          >
            ←
          </button>
          <div className="flex items-center justify-center">
            <div className="text-xs text-gray-600 text-center">
              {gameState === "START" && "TAP TO START"}
              {gameState === "PLAYING" && "PLAYING"}
              {gameState === "GAME_OVER" && "TAP TO PLAY"}
            </div>
          </div>
          <button
            onTouchStart={() => handleMobileControl("RIGHT")}
            onClick={() => handleMobileControl("RIGHT")}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white p-3 rounded touch-manipulation"
          >
            →
          </button>
          <div></div>
          <button
            onTouchStart={() => handleMobileControl("DOWN")}
            onClick={() => handleMobileControl("DOWN")}
            className="bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white p-3 rounded touch-manipulation"
          >
            ↓
          </button>
          <div></div>
        </div>
      </div>

      {/* Desktop Start Button */}
      {(gameState === "START" || gameState === "GAME_OVER") && (
        <button
          onClick={() => startGame("RIGHT")}
          className="hidden md:block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
        >
          {gameState === "START" ? "Start Game" : "Play Again"}
        </button>
      )}
    </div>
  )
}
