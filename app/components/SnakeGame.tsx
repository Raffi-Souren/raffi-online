"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 240
const GRID_SIZE = 10

interface Position {
  x: number
  y: number
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<"start" | "playing" | "gameOver">("start")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [snake, setSnake] = useState<Position[]>([{ x: 160, y: 120 }])
  const [food, setFood] = useState<Position>({ x: 200, y: 160 })
  const [direction, setDirection] = useState<Direction>("RIGHT")
  const [nextDirection, setNextDirection] = useState<Direction>("RIGHT")
  const gameLoopRef = useRef<NodeJS.Timeout>()

  const generateFood = useCallback(() => {
    const x = Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)) * GRID_SIZE
    const y = Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)) * GRID_SIZE
    return { x, y }
  }, [])

  const resetGame = useCallback(() => {
    setSnake([{ x: 160, y: 120 }])
    setFood(generateFood())
    setDirection("RIGHT")
    setNextDirection("RIGHT")
    setScore(0)
  }, [generateFood])

  const startGame = useCallback(
    (initialDirection?: Direction) => {
      resetGame()
      if (initialDirection) {
        setDirection(initialDirection)
        setNextDirection(initialDirection)
      }
      setGameState("playing")
    },
    [resetGame],
  )

  const gameOver = useCallback(() => {
    setGameState("gameOver")
    if (score > highScore) {
      setHighScore(score)
    }
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }
  }, [score, highScore])

  const moveSnake = useCallback(() => {
    setSnake((currentSnake) => {
      const newSnake = [...currentSnake]
      const head = { ...newSnake[0] }

      // Update direction
      setDirection(nextDirection)

      // Move head based on direction
      switch (nextDirection) {
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
        gameOver()
        return currentSnake
      }

      // Check self collision
      if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        gameOver()
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
  }, [nextDirection, food, gameOver, generateFood])

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") return

    gameLoopRef.current = setInterval(moveSnake, 150)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, moveSnake])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === "start") {
        let startDirection: Direction = "RIGHT"
        if (e.key === "ArrowUp" || e.key === "2") startDirection = "UP"
        else if (e.key === "ArrowDown" || e.key === "8") startDirection = "DOWN"
        else if (e.key === "ArrowLeft" || e.key === "4") startDirection = "LEFT"
        else if (e.key === "ArrowRight" || e.key === "6") startDirection = "RIGHT"
        else return

        startGame(startDirection)
        return
      }

      if (gameState === "gameOver") {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "2", "4", "6", "8"].includes(e.key)) {
          startGame()
        }
        return
      }

      if (gameState === "playing") {
        let newDirection: Direction | null = null

        if (e.key === "ArrowUp" || e.key === "2") newDirection = "UP"
        else if (e.key === "ArrowDown" || e.key === "8") newDirection = "DOWN"
        else if (e.key === "ArrowLeft" || e.key === "4") newDirection = "LEFT"
        else if (e.key === "ArrowRight" || e.key === "6") newDirection = "RIGHT"

        if (newDirection) {
          // Prevent reverse direction
          const opposites: Record<Direction, Direction> = {
            UP: "DOWN",
            DOWN: "UP",
            LEFT: "RIGHT",
            RIGHT: "LEFT",
          }

          if (opposites[direction] !== newDirection) {
            setNextDirection(newDirection)
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState, direction, startGame])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (gameState === "start") {
      // Draw start screen
      ctx.fillStyle = "#00FF00"
      ctx.font = "20px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Snake", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

      ctx.font = "12px monospace"
      ctx.fillText("Use keypad: 2↑ 4← 6→ 8↓", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10)
      ctx.fillText("Eat red food to grow!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)

      // Mobile instruction
      ctx.font = "10px monospace"
      ctx.fillText("TAP TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)

      // Draw score
      ctx.textAlign = "left"
      ctx.fillText(`Score: ${score}`, 10, 20)
      ctx.fillText(`High: ${highScore}`, 10, 35)
      return
    }

    if (gameState === "playing") {
      // Draw snake
      ctx.fillStyle = "#00FF00"
      snake.forEach((segment, index) => {
        if (index === 0) {
          // Snake head
          ctx.fillStyle = "#FFFF00"
        } else {
          ctx.fillStyle = "#00FF00"
        }
        ctx.fillRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE)
      })

      // Draw food
      ctx.fillStyle = "#FF0000"
      ctx.fillRect(food.x, food.y, GRID_SIZE, GRID_SIZE)

      // Draw score
      ctx.fillStyle = "#00FF00"
      ctx.font = "12px monospace"
      ctx.textAlign = "left"
      ctx.fillText(`Score: ${score}`, 10, 20)
      ctx.fillText(`High: ${highScore}`, 10, 35)
    }

    if (gameState === "gameOver") {
      // Draw game over screen
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.fillStyle = "#FF0000"
      ctx.font = "24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

      ctx.fillStyle = "#00FF00"
      ctx.font = "14px monospace"
      ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10)
      ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10)
      ctx.fillText("Press any arrow key to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)

      // Mobile instruction
      ctx.font = "10px monospace"
      ctx.fillText("TAP TO PLAY", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60)
    }
  }, [gameState, snake, food, score, highScore])

  const handleMobileControl = (dir: Direction) => {
    if (gameState === "start") {
      startGame(dir)
    } else if (gameState === "gameOver") {
      startGame()
    } else if (gameState === "playing") {
      // Prevent reverse direction
      const opposites: Record<Direction, Direction> = {
        UP: "DOWN",
        DOWN: "UP",
        LEFT: "RIGHT",
        RIGHT: "LEFT",
      }

      if (opposites[direction] !== dir) {
        setNextDirection(dir)
      }
    }
  }

  return (
    <div className="flex flex-col items-center w-full h-full bg-gray-800 p-4">
      {/* Game Canvas */}
      <div className="relative mb-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-gray-600 bg-black"
          style={{
            imageRendering: "pixelated",
            maxWidth: "100%",
            height: "auto",
          }}
        />
      </div>

      {/* Mobile Controls */}
      <div className="grid grid-cols-3 gap-2 w-48 md:hidden touch-manipulation">
        <div></div>
        <button
          onClick={() => handleMobileControl("UP")}
          onTouchStart={() => handleMobileControl("UP")}
          className="w-12 h-12 bg-gray-700 text-white rounded flex items-center justify-center text-xl font-bold active:bg-gray-600"
        >
          ↑
        </button>
        <div></div>

        <button
          onClick={() => handleMobileControl("LEFT")}
          onTouchStart={() => handleMobileControl("LEFT")}
          className="w-12 h-12 bg-gray-700 text-white rounded flex items-center justify-center text-xl font-bold active:bg-gray-600"
        >
          ←
        </button>

        <div className="w-12 h-12 bg-gray-900 rounded flex items-center justify-center text-xs text-gray-400 font-bold">
          {gameState === "start" ? "TAP TO START" : gameState === "gameOver" ? "TAP TO PLAY" : "SNAKE"}
        </div>

        <button
          onClick={() => handleMobileControl("RIGHT")}
          onTouchStart={() => handleMobileControl("RIGHT")}
          className="w-12 h-12 bg-gray-700 text-white rounded flex items-center justify-center text-xl font-bold active:bg-gray-600"
        >
          →
        </button>

        <div></div>
        <button
          onClick={() => handleMobileControl("DOWN")}
          onTouchStart={() => handleMobileControl("DOWN")}
          className="w-12 h-12 bg-gray-700 text-white rounded flex items-center justify-center text-xl font-bold active:bg-gray-600"
        >
          ↓
        </button>
        <div></div>
      </div>

      {/* Desktop Start Button */}
      {gameState === "start" && (
        <button
          onClick={() => startGame()}
          className="hidden md:block mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
        >
          Start Game
        </button>
      )}
    </div>
  )
}
