"use client"

import { useEffect, useRef, useState } from "react"

const CANVAS_WIDTH = 300
const CANVAS_HEIGHT = 400
const PADDLE_WIDTH = 60
const PADDLE_HEIGHT = 10
const BALL_RADIUS = 5
const BRICK_ROWS = 6
const BRICK_COLUMNS = 8
const BRICK_WIDTH = 32
const BRICK_HEIGHT = 16
const BRICK_PADDING = 2
const BALL_SPEED = 4

interface Brick {
  x: number
  y: number
  width: number
  height: number
  status: number
  color: string
  points: number
}

export default function Brickbreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)

  const gameStateRef = useRef({
    paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT - 50,
    ballDX: BALL_SPEED,
    ballDY: -BALL_SPEED,
    bricks: [] as Brick[][],
    animationId: null as number | null,
    keys: {} as Record<string, boolean>,
  })

  const createBricks = () => {
    const bricks: Brick[][] = []
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]

    for (let c = 0; c < BRICK_COLUMNS; c++) {
      bricks[c] = []
      for (let r = 0; r < BRICK_ROWS; r++) {
        const brickX = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_PADDING
        const brickY = r * (BRICK_HEIGHT + BRICK_PADDING) + 60
        bricks[c][r] = {
          x: brickX,
          y: brickY,
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          status: 1,
          color: colors[r % colors.length],
          points: (BRICK_ROWS - r) * 10,
        }
      }
    }
    return bricks
  }

  const resetGame = () => {
    gameStateRef.current = {
      ...gameStateRef.current,
      paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
      ballX: CANVAS_WIDTH / 2,
      ballY: CANVAS_HEIGHT - 50,
      ballDX: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
      ballDY: -BALL_SPEED,
      bricks: createBricks(),
    }
    setScore(0)
    setLives(3)
    setLevel(1)
    setGameOver(false)
    setGameWon(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !gameStarted) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const gameState = gameStateRef.current

    const handleKeyDown = (e: KeyboardEvent) => {
      gameState.keys[e.key] = true
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.keys[e.key] = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const scaleX = CANVAS_WIDTH / rect.width
      gameState.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, relativeX * scaleX - PADDLE_WIDTH / 2))
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const relativeX = e.touches[0].clientX - rect.left
      const scaleX = CANVAS_WIDTH / rect.width
      gameState.paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, relativeX * scaleX - PADDLE_WIDTH / 2))
    }

    const drawBall = () => {
      ctx.beginPath()
      ctx.arc(gameState.ballX, gameState.ballY, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = "#FFFFFF"
      ctx.fill()
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.closePath()
    }

    const drawPaddle = () => {
      const gradient = ctx.createLinearGradient(
        gameState.paddleX,
        CANVAS_HEIGHT - PADDLE_HEIGHT,
        gameState.paddleX,
        CANVAS_HEIGHT,
      )
      gradient.addColorStop(0, "#4ECDC4")
      gradient.addColorStop(1, "#44A08D")

      ctx.fillStyle = gradient
      ctx.fillRect(gameState.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT)

      // Add highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)"
      ctx.fillRect(gameState.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, PADDLE_WIDTH, 3)
    }

    const drawBricks = () => {
      for (let c = 0; c < BRICK_COLUMNS; c++) {
        for (let r = 0; r < BRICK_ROWS; r++) {
          if (gameState.bricks[c][r].status === 1) {
            const brick = gameState.bricks[c][r]

            // Draw brick with gradient
            const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height)
            gradient.addColorStop(0, brick.color)
            gradient.addColorStop(1, brick.color + "AA")

            ctx.fillStyle = gradient
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height)

            // Add border
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 1
            ctx.strokeRect(brick.x, brick.y, brick.width, brick.height)

            // Add highlight
            ctx.fillStyle = "rgba(255,255,255,0.3)"
            ctx.fillRect(brick.x, brick.y, brick.width, 3)
          }
        }
      }
    }

    const collisionDetection = () => {
      for (let c = 0; c < BRICK_COLUMNS; c++) {
        for (let r = 0; r < BRICK_ROWS; r++) {
          const brick = gameState.bricks[c][r]
          if (brick.status === 1) {
            if (
              gameState.ballX > brick.x &&
              gameState.ballX < brick.x + brick.width &&
              gameState.ballY > brick.y &&
              gameState.ballY < brick.y + brick.height
            ) {
              gameState.ballDY = -gameState.ballDY
              brick.status = 0
              setScore((prev) => prev + brick.points)

              // Check if all bricks are destroyed
              let remainingBricks = 0
              for (let cc = 0; cc < BRICK_COLUMNS; cc++) {
                for (let rr = 0; rr < BRICK_ROWS; rr++) {
                  if (gameState.bricks[cc][rr].status === 1) {
                    remainingBricks++
                  }
                }
              }

              if (remainingBricks === 0) {
                setGameWon(true)
                setGameStarted(false)
              }
            }
          }
        }
      }
    }

    const updatePaddle = () => {
      if (gameState.keys["ArrowLeft"] || gameState.keys["a"]) {
        gameState.paddleX = Math.max(0, gameState.paddleX - 7)
      }
      if (gameState.keys["ArrowRight"] || gameState.keys["d"]) {
        gameState.paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, gameState.paddleX + 7)
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Draw background gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      bgGradient.addColorStop(0, "#2C3E50")
      bgGradient.addColorStop(1, "#34495E")
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      drawBricks()
      drawBall()
      drawPaddle()
      collisionDetection()
      updatePaddle()

      // Ball movement and collision
      if (
        gameState.ballX + gameState.ballDX > CANVAS_WIDTH - BALL_RADIUS ||
        gameState.ballX + gameState.ballDX < BALL_RADIUS
      ) {
        gameState.ballDX = -gameState.ballDX
      }

      if (gameState.ballY + gameState.ballDY < BALL_RADIUS) {
        gameState.ballDY = -gameState.ballDY
      } else if (gameState.ballY + gameState.ballDY > CANVAS_HEIGHT - BALL_RADIUS) {
        if (gameState.ballX > gameState.paddleX && gameState.ballX < gameState.paddleX + PADDLE_WIDTH) {
          // Calculate angle based on where ball hits paddle
          const hitPoint = (gameState.ballX - gameState.paddleX) / PADDLE_WIDTH
          const angle = (hitPoint - 0.5) * Math.PI * 0.3 // Max 30 degree angle

          gameState.ballDX = BALL_SPEED * Math.sin(angle)
          gameState.ballDY = -BALL_SPEED * Math.cos(angle)
        } else {
          setLives((prev) => {
            const newLives = prev - 1
            if (newLives <= 0) {
              setGameOver(true)
              setGameStarted(false)
              return 0
            } else {
              // Reset ball position
              gameState.ballX = CANVAS_WIDTH / 2
              gameState.ballY = CANVAS_HEIGHT - 50
              gameState.ballDX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1)
              gameState.ballDY = -BALL_SPEED
              gameState.paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2
              return newLives
            }
          })
        }
      }

      gameState.ballX += gameState.ballDX
      gameState.ballY += gameState.ballDY

      // Draw UI
      ctx.fillStyle = "#FFFFFF"
      ctx.font = "16px Arial"
      ctx.fillText(`Score: ${score}`, 10, 25)
      ctx.fillText(`Lives: ${lives}`, 10, 45)
      ctx.fillText(`Level: ${level}`, CANVAS_WIDTH - 80, 25)

      if (gameStarted && !gameOver && !gameWon) {
        gameState.animationId = requestAnimationFrame(draw)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })

    if (gameStarted) {
      draw()
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchmove", handleTouchMove)
      if (gameState.animationId) {
        cancelAnimationFrame(gameState.animationId)
      }
    }
  }, [gameStarted, gameOver, gameWon, score, lives, level])

  const startGame = () => {
    resetGame()
    setGameStarted(true)
  }

  return (
    <div className="flex flex-col items-center relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-600 rounded max-w-full h-auto"
        tabIndex={0}
      />
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded">
          <div className="text-center space-y-4 p-4">
            <h2 className="text-2xl font-bold text-white">Brickbreaker</h2>
            {gameOver && (
              <>
                <div className="text-red-400 text-lg">Game Over!</div>
                <div className="text-white">Final Score: {score}</div>
              </>
            )}
            {gameWon && (
              <>
                <div className="text-green-400 text-lg">Level Complete!</div>
                <div className="text-white">Score: {score}</div>
              </>
            )}
            <button
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold min-h-[44px]"
              onClick={startGame}
            >
              {gameOver || gameWon ? "Play Again" : "Start Game"}
            </button>
            <div className="text-white text-sm space-y-1">
              <div className="md:block hidden">Use mouse/touch or arrow keys/A,D to control paddle</div>
              <div className="md:hidden block">Touch and drag to control paddle</div>
              <div>Destroy all bricks to win!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
