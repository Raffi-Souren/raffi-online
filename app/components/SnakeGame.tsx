"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"

const CANVAS_WIDTH = 220
const CANVAS_HEIGHT = 280
const GRID_SIZE = 10
const SNAKE_COLOR = "#4CAF50"
const FOOD_COLOR = "#FF5722"
const BOARD_COLOR = "#2E2E2E"

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type Position = { x: number; y: number }

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const [snake, setSnake] = useState<Position[]>([{ x: 11, y: 14 }])
  const [food, setFood] = useState<Position>({ x: 16, y: 18 })
  const [direction, setDirection] = useState<Direction>("RIGHT")
  const [nextDirection, setNextDirection] = useState<Direction>("RIGHT")
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameSpeed, setGameSpeed] = useState(200)

  const gridWidth = Math.floor(CANVAS_WIDTH / GRID_SIZE)
  const gridHeight = Math.floor(CANVAS_HEIGHT / GRID_SIZE)

  const generateFood = useCallback(() => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * gridWidth),
        y: Math.floor(Math.random() * gridHeight),
      }
    } while (snake.some((segment) => segment.x === newFood.x && segment.y === newFood.y))
    return newFood
  }, [snake, gridWidth, gridHeight])

  const moveSnake = useCallback(() => {
    setSnake((currentSnake) => {
      const newSnake = [...currentSnake]
      const head = { ...newSnake[0] }

      // Use nextDirection to prevent reverse direction issues
      const moveDirection = nextDirection

      switch (moveDirection) {
        case "UP":
          head.y--
          break
        case "DOWN":
          head.y++
          break
        case "LEFT":
          head.x--
          break
        case "RIGHT":
          head.x++
          break
      }

      // Check wall collision
      if (head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight) {
        setGameOver(true)
        setGameStarted(false)
        return currentSnake
      }

      // Check self collision
      if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true)
        setGameStarted(false)
        return currentSnake
      }

      newSnake.unshift(head)

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        const newScore = score + 10
        setScore(newScore)
        if (newScore > highScore) {
          setHighScore(newScore)
        }
        setFood(generateFood())
        // Increase speed slightly
        setGameSpeed((prev) => Math.max(100, prev - 3))
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [nextDirection, food, score, highScore, generateFood, gridWidth, gridHeight])

  // Mobile touch controls
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      if (!gameStarted) {
        startGame()
        return
      }
    },
    [gameStarted],
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
  }, [])

  // Mobile direction controls
  const changeDirection = useCallback(
    (newDirection: Direction) => {
      if (!gameStarted) return

      switch (newDirection) {
        case "UP":
          if (direction !== "DOWN") setNextDirection("UP")
          break
        case "DOWN":
          if (direction !== "UP") setNextDirection("DOWN")
          break
        case "LEFT":
          if (direction !== "RIGHT") setNextDirection("LEFT")
          break
        case "RIGHT":
          if (direction !== "LEFT") setNextDirection("RIGHT")
          break
      }
    },
    [gameStarted, direction],
  )

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted) {
        // Handle space bar for start
        if (e.key === " ") {
          e.preventDefault()
          startGame()
          return
        }
        return
      }

      e.preventDefault()
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
        case "2":
          if (direction !== "DOWN") setNextDirection("UP")
          break
        case "ArrowDown":
        case "s":
        case "S":
        case "8":
          if (direction !== "UP") setNextDirection("DOWN")
          break
        case "ArrowLeft":
        case "a":
        case "A":
        case "4":
          if (direction !== "RIGHT") setNextDirection("LEFT")
          break
        case "ArrowRight":
        case "d":
        case "D":
        case "6":
          if (direction !== "LEFT") setNextDirection("RIGHT")
          break
        case " ":
          // Pause/unpause functionality could go here
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameStarted, direction])

  useEffect(() => {
    setDirection(nextDirection)
  }, [nextDirection])

  useEffect(() => {
    if (!gameStarted || gameOver) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
      return
    }

    gameLoopRef.current = setInterval(moveSnake, gameSpeed)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameStarted, gameOver, moveSnake, gameSpeed])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw background
    ctx.fillStyle = BOARD_COLOR
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid lines (subtle)
    ctx.strokeStyle = "#404040"
    ctx.lineWidth = 0.5
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    // Draw food with glow effect
    ctx.shadowColor = FOOD_COLOR
    ctx.shadowBlur = 8
    ctx.fillStyle = FOOD_COLOR
    ctx.fillRect(food.x * GRID_SIZE + 1, food.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2)
    ctx.shadowBlur = 0

    // Draw snake
    snake.forEach((segment, index) => {
      if (index === 0) {
        // Head
        ctx.fillStyle = "#66BB6A"
        ctx.shadowColor = SNAKE_COLOR
        ctx.shadowBlur = 4
      } else {
        // Body
        ctx.fillStyle = SNAKE_COLOR
        ctx.shadowBlur = 0
      }
      ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2)
    })
    ctx.shadowBlur = 0

    // Draw score
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "10px Arial"
    ctx.fillText(`Score: ${score}`, 4, 12)
    ctx.fillText(`High: ${highScore}`, 4, 24)
    ctx.fillText(`Length: ${snake.length}`, CANVAS_WIDTH - 60, 12)
  }, [snake, food, score, highScore])

  const startGame = () => {
    setSnake([{ x: 11, y: 14 }])
    setFood({ x: 16, y: 18 })
    setDirection("RIGHT")
    setNextDirection("RIGHT")
    setGameOver(false)
    setScore(0)
    setGameSpeed(200)
    setGameStarted(true)
  }

  return (
    <div className="relative w-full h-full bg-gray-800">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full object-contain"
        style={{ imageRendering: "pixelated" }}
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Mobile Controls */}
      {gameStarted && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 md:hidden">
          <div className="grid grid-cols-3 gap-2 bg-black bg-opacity-50 p-3 rounded-lg">
            <div></div>
            <button
              className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
              onTouchStart={(e) => {
                e.preventDefault()
                changeDirection("UP")
              }}
            >
              ↑
            </button>
            <div></div>
            <button
              className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
              onTouchStart={(e) => {
                e.preventDefault()
                changeDirection("LEFT")
              }}
            >
              ←
            </button>
            <div></div>
            <button
              className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
              onTouchStart={(e) => {
                e.preventDefault()
                changeDirection("RIGHT")
              }}
            >
              →
            </button>
            <div></div>
            <button
              className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
              onTouchStart={(e) => {
                e.preventDefault()
                changeDirection("DOWN")
              }}
            >
              ↓
            </button>
            <div></div>
          </div>
        </div>
      )}

      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
          <div className="text-center space-y-2 p-3">
            <h2 className="text-sm font-bold text-white">Snake</h2>
            {gameOver && (
              <>
                <div className="text-red-400 text-xs">Game Over!</div>
                <div className="text-white text-xs">Final Score: {score}</div>
                <div className="text-white text-xs">Length: {snake.length}</div>
                {score === highScore && score > 0 && <div className="text-yellow-400 text-xs">New High Score! 🏆</div>}
              </>
            )}
            <button
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 font-bold text-xs min-h-[44px]"
              onClick={startGame}
            >
              {gameOver ? "Play Again" : "Start Game"}
            </button>
            <div className="text-white text-xs space-y-1">
              <div className="md:block hidden">Use keypad: 2↑ 4← 6→ 8↓</div>
              <div className="md:hidden block">Tap to start, use on-screen controls</div>
              <div>Eat red food to grow!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
