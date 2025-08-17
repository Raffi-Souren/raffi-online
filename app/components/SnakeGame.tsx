"use client"

import { useState, useEffect, useRef, useCallback } from "react"

const CANVAS_WIDTH = 240
const CANVAS_HEIGHT = 320
const GRID_SIZE = 12
const SNAKE_COLOR = "#4CAF50"
const FOOD_COLOR = "#FF5722"
const BOARD_COLOR = "#2E2E2E"

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type Position = { x: number; y: number }

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<Position>({ x: 15, y: 15 })
  const [direction, setDirection] = useState<Direction>("RIGHT")
  const [nextDirection, setNextDirection] = useState<Direction>("RIGHT")
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameSpeed, setGameSpeed] = useState(150)

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
        setGameSpeed((prev) => Math.max(80, prev - 2))
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [nextDirection, food, score, highScore, generateFood, gridWidth, gridHeight])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted) return

      e.preventDefault()
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          if (direction !== "DOWN") setNextDirection("UP")
          break
        case "ArrowDown":
        case "s":
        case "S":
          if (direction !== "UP") setNextDirection("DOWN")
          break
        case "ArrowLeft":
        case "a":
        case "A":
          if (direction !== "RIGHT") setNextDirection("LEFT")
          break
        case "ArrowRight":
        case "d":
        case "D":
          if (direction !== "LEFT") setNextDirection("RIGHT")
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

    // Draw grid lines
    ctx.strokeStyle = "#404040"
    ctx.lineWidth = 1
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
    ctx.shadowBlur = 10
    ctx.fillStyle = FOOD_COLOR
    ctx.fillRect(food.x * GRID_SIZE + 1, food.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2)
    ctx.shadowBlur = 0

    // Draw snake
    snake.forEach((segment, index) => {
      if (index === 0) {
        // Head
        ctx.fillStyle = "#66BB6A"
        ctx.shadowColor = SNAKE_COLOR
        ctx.shadowBlur = 5
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
    ctx.font = "14px Arial"
    ctx.fillText(`Score: ${score}`, 5, 15)
    ctx.fillText(`High: ${highScore}`, 5, 30)
    ctx.fillText(`Length: ${snake.length}`, CANVAS_WIDTH - 70, 15)
  }, [snake, food, score, highScore])

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }])
    setFood({ x: 15, y: 15 })
    setDirection("RIGHT")
    setNextDirection("RIGHT")
    setGameOver(false)
    setScore(0)
    setGameSpeed(150)
    setGameStarted(true)
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="bg-gray-800 border-2 border-gray-600 rounded"
        tabIndex={0}
      />
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Snake Game</h2>
            {gameOver && (
              <>
                <div className="text-red-400 text-lg">Game Over!</div>
                <div className="text-white">Final Score: {score}</div>
                <div className="text-white">Length: {snake.length}</div>
                {score === highScore && score > 0 && <div className="text-yellow-400">New High Score! 🏆</div>}
              </>
            )}
            <button
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-bold"
              onClick={startGame}
            >
              {gameOver ? "Play Again" : "Start Game"}
            </button>
            <div className="text-white text-sm space-y-1">
              <div>Use arrow keys or WASD to control</div>
              <div>Eat red food to grow and score points!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
