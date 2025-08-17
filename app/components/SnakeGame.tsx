'use client'

import React, { useState, useEffect, useRef } from 'react'

const CANVAS_WIDTH = 240
const CANVAS_HEIGHT = 320
const GRID_SIZE = 10
const SNAKE_COLOR = '#333333'
const FOOD_COLOR = '#FF0000'

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [snake, setSnake] = useState<Position[]>([{ x: 5, y: 5 }])
  const [food, setFood] = useState<Position>({ x: 10, y: 10 })
  const [direction, setDirection] = useState<Direction>('RIGHT')
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          setDirection('UP')
          break
        case 'ArrowDown':
          setDirection('DOWN')
          break
        case 'ArrowLeft':
          setDirection('LEFT')
          break
        case 'ArrowRight':
          setDirection('RIGHT')
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  useEffect(() => {
    if (!gameStarted) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!ctx) return

    const gameLoop = setInterval(() => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Draw food
      ctx.fillStyle = FOOD_COLOR
      ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE, GRID_SIZE)

      // Move snake
      const newSnake = [...snake]
      const head = { ...newSnake[0] }

      switch (direction) {
        case 'UP':
          head.y--
          break
        case 'DOWN':
          head.y++
          break
        case 'LEFT':
          head.x--
          break
        case 'RIGHT':
          head.x++
          break
      }

      // Check collision with walls
      if (
        head.x < 0 ||
        head.x >= CANVAS_WIDTH / GRID_SIZE ||
        head.y < 0 ||
        head.y >= CANVAS_HEIGHT / GRID_SIZE
      ) {
        setGameOver(true)
        clearInterval(gameLoop)
        return
      }

      // Check collision with self
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true)
        clearInterval(gameLoop)
        return
      }

      newSnake.unshift(head)

      // Check if snake ate food
      if (head.x === food.x && head.y === food.y) {
        setScore(prevScore => prevScore + 1)
        setFood({
          x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
          y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE))
        })
      } else {
        newSnake.pop()
      }

      setSnake(newSnake)

      // Draw snake
      ctx.fillStyle = SNAKE_COLOR
      newSnake.forEach(segment => {
        ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE)
      })

      // Draw score
      ctx.fillStyle = '#000000'
      ctx.font = '20px Arial'
      ctx.fillText(`Score: ${score}`, 10, 30)
    }, 100)

    return () => clearInterval(gameLoop)
  }, [snake, food, direction, gameStarted, score])

  const startGame = () => {
    setSnake([{ x: 5, y: 5 }])
    setFood({
      x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
      y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE))
    })
    setDirection('RIGHT')
    setGameOver(false)
    setScore(0)
    setGameStarted(true)
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="bg-gray-100"
      />
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center">
            {gameOver ? (
              <>
                <div className="text-white mb-2">Game Over</div>
                <div className="text-white mb-4">Score: {score}</div>
              </>
            ) : (
              <div className="text-white mb-4">Snake</div>
            )}
            <button
              className="px-4 py-2 bg-white text-black rounded"
              onClick={startGame}
            >
              {gameOver ? 'Play Again' : 'Start'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
