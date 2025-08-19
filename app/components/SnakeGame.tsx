"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"

const CANVAS_WIDTH = 220
const CANVAS_HEIGHT = 280
const GRID_SIZE = 10
const INITIAL_SNAKE = [{ x: 10, y: 10 }]
const INITIAL_DIRECTION = { x: 0, y: -1 }
const INITIAL_FOOD = { x: 15, y: 15 }

interface Position {
  x: number
  y: number
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE)
  const [direction, setDirection] = useState<Position>(INITIAL_DIRECTION)
  const [food, setFood] = useState<Position>(INITIAL_FOOD)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)

  const generateFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
        y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)),
      }
    } while (currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y))
    return newFood
  }, [])

  const moveSnake = useCallback(() => {
    if (!gameStarted || gameOver) return

    setSnake((currentSnake) => {
      const newSnake = [...currentSnake]
      const head = { ...newSnake[0] }

      head.x += direction.x
      head.y += direction.y

      // Check wall collision
      if (head.x < 0 || head.x >= CANVAS_WIDTH / GRID_SIZE || head.y < 0 || head.y >= CANVAS_HEIGHT / GRID_SIZE) {
        setGameOver(true)
        setGameStarted(false)
        if (score > highScore) {
          setHighScore(score)
        }
        return currentSnake
      }

      // Check self collision
      if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true)
        setGameStarted(false)
        if (score > highScore) {
          setHighScore(score)
        }
        return currentSnake
      }

      newSnake.unshift(head)

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        setScore((prev) => prev + 1)
        setFood(generateFood(newSnake))
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [direction, food, gameStarted, gameOver, score, highScore, generateFood])

  const changeDirection = useCallback(
    (newDirection: Position) => {
      if (!gameStarted || gameOver) return
      // Prevent reverse direction
      if (direction.x === -newDirection.x && direction.y === -newDirection.y) return
      setDirection(newDirection)
    },
    [direction, gameStarted, gameOver],
  )

  const startGame = useCallback(() => {
    setSnake(INITIAL_SNAKE)
    setDirection(INITIAL_DIRECTION)
    setFood(generateFood(INITIAL_SNAKE))
    setScore(0)
    setGameOver(false)
    setGameStarted(true)
  }, [generateFood])

  const resetGame = useCallback(() => {
    setGameStarted(false)
    setGameOver(false)
  }, [])

  // Touch controls for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, dir: Position) => {
      e.preventDefault()
      if (!gameStarted && !gameOver) {
        startGame()
      } else if (gameStarted && !gameOver) {
        changeDirection(dir)
      } else if (gameOver) {
        resetGame()
      }
    },
    [gameStarted, gameOver, startGame, changeDirection, resetGame],
  )

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted && !gameOver && e.key === " ") {
        e.preventDefault()
        startGame()
        return
      }

      if (gameOver && e.key === " ") {
        e.preventDefault()
        resetGame()
        return
      }

      if (!gameStarted || gameOver) return

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
        case "2":
          e.preventDefault()
          changeDirection({ x: 0, y: -1 })
          break
        case "ArrowDown":
        case "s":
        case "S":
        case "8":
          e.preventDefault()
          changeDirection({ x: 0, y: 1 })
          break
        case "ArrowLeft":
        case "a":
        case "A":
        case "4":
          e.preventDefault()
          changeDirection({ x: -1, y: 0 })
          break
        case "ArrowRight":
        case "d":
        case "D":
        case "6":
          e.preventDefault()
          changeDirection({ x: 1, y: 0 })
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameStarted, gameOver, startGame, resetGame, changeDirection])

  // Game loop
  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = setInterval(moveSnake, 150)
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameStarted, gameOver, moveSnake])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw snake
    ctx.fillStyle = "#0f0"
    snake.forEach((segment) => {
      ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1)
    })

    // Draw food
    ctx.fillStyle = "#f00"
    ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE - 1, GRID_SIZE - 1)

    // Draw score
    ctx.fillStyle = "#fff"
    ctx.font = "12px monospace"
    ctx.fillText(`Score: ${score}`, 5, 15)
    ctx.fillText(`High: ${highScore}`, 5, 30)
  }, [snake, food, score, highScore])

  return (
    <div className="flex flex-col w-full h-full bg-gray-100 overflow-hidden">
      {/* Game Canvas Container - Fit to window */}
      <div className="relative flex-1 flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block max-w-full max-h-full object-contain border border-gray-400 rounded"
          style={{
            imageRendering: "pixelated",
            width: "auto",
            height: "auto",
          }}
        />

        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded">
            <div className="text-center text-white p-4">
              <h3 className="text-lg font-bold mb-2">Snake</h3>
              <p className="text-sm mb-2">Use keypad: 2↑ 4← 6→ 8↓</p>
              <p className="text-sm">Eat red food to grow!</p>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded">
            <div className="text-center text-white p-4">
              <h3 className="text-lg font-bold mb-2">Game Over!</h3>
              <p className="text-sm mb-1">Final Score: {score}</p>
              <p className="text-sm mb-1">Length: {snake.length}</p>
              {score > highScore && <p className="text-yellow-400 text-sm mb-2">New High Score! 🏆</p>}
              <button
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-bold"
                onClick={resetGame}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Controls - Always visible on mobile */}
      <div className="flex justify-center py-2 md:hidden bg-gray-100">
        <div className="grid grid-cols-3 gap-2 bg-black bg-opacity-50 p-3 rounded-lg">
          <div></div>
          <button
            className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
            onTouchStart={(e) => handleTouchStart(e, { x: 0, y: -1 })}
            onClick={() => {
              if (!gameStarted && !gameOver) {
                startGame()
                setDirection({ x: 0, y: -1 })
              } else if (gameStarted && !gameOver) {
                changeDirection({ x: 0, y: -1 })
              } else if (gameOver) {
                resetGame()
              }
            }}
          >
            ↑
          </button>
          <div></div>
          <button
            className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
            onTouchStart={(e) => handleTouchStart(e, { x: -1, y: 0 })}
            onClick={() => {
              if (!gameStarted && !gameOver) {
                startGame()
                setDirection({ x: -1, y: 0 })
              } else if (gameStarted && !gameOver) {
                changeDirection({ x: -1, y: 0 })
              } else if (gameOver) {
                resetGame()
              }
            }}
          >
            ←
          </button>
          <div className="w-12 h-12 flex items-center justify-center">
            {!gameStarted && !gameOver && (
              <div className="text-white text-xs text-center">
                TAP
                <br />
                TO
                <br />
                START
              </div>
            )}
            {gameOver && (
              <div className="text-white text-xs text-center">
                TAP
                <br />
                TO
                <br />
                PLAY
              </div>
            )}
          </div>
          <button
            className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
            onTouchStart={(e) => handleTouchStart(e, { x: 1, y: 0 })}
            onClick={() => {
              if (!gameStarted && !gameOver) {
                startGame()
                setDirection({ x: 1, y: 0 })
              } else if (gameStarted && !gameOver) {
                changeDirection({ x: 1, y: 0 })
              } else if (gameOver) {
                resetGame()
              }
            }}
          >
            →
          </button>
          <div></div>
          <button
            className="w-12 h-12 bg-gray-700 text-white rounded-lg flex items-center justify-center text-xl font-bold active:bg-gray-600"
            onTouchStart={(e) => handleTouchStart(e, { x: 0, y: 1 })}
            onClick={() => {
              if (!gameStarted && !gameOver) {
                startGame()
                setDirection({ x: 0, y: 1 })
              } else if (gameStarted && !gameOver) {
                changeDirection({ x: 0, y: 1 })
              } else if (gameOver) {
                resetGame()
              }
            }}
          >
            ↓
          </button>
          <div></div>
        </div>
      </div>
    </div>
  )
}
