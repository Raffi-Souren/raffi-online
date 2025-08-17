'use client'

import React, { useEffect, useRef, useState } from 'react'

const CANVAS_WIDTH = 300
const CANVAS_HEIGHT = 400
const PADDLE_WIDTH = 60
const PADDLE_HEIGHT = 10
const BALL_RADIUS = 4
const BRICK_ROWS = 8
const BRICK_COLUMNS = 8
const BRICK_WIDTH = 30
const BRICK_HEIGHT = 15
const BRICK_PADDING = 2
const BALL_SPEED = 3

interface Brick {
  x: number
  y: number
  width: number
  height: number
  status: number
  color: string
}

interface PowerUp {
  type: 'missile' | 'expand'
  count: number
}

export default function Brickbreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [powerUps, setPowerUps] = useState<PowerUp[]>([
    { type: 'missile', count: 0 },
    { type: 'expand', count: 3 }
  ])
  const [level, setLevel] = useState(1)
  const [touchStartX, setTouchStartX] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2
    let ballX = CANVAS_WIDTH / 2
    let ballY = CANVAS_HEIGHT - 30
    let ballDX = BALL_SPEED
    let ballDY = -BALL_SPEED
    let isExpanded = false

    // Create industrial-style bricks
    const createBricks = () => {
      const bricks: Brick[][] = []
      for (let c = 0; c < BRICK_COLUMNS; c++) {
        bricks[c] = []
        for (let r = 0; r < BRICK_ROWS; r++) {
          const brickX = (c * (BRICK_WIDTH + BRICK_PADDING)) + (CANVAS_WIDTH - (BRICK_COLUMNS * (BRICK_WIDTH + BRICK_PADDING))) / 2
          const brickY = (r * (BRICK_HEIGHT + BRICK_PADDING)) + 50
          bricks[c][r] = {
            x: brickX,
            y: brickY,
            width: BRICK_WIDTH,
            height: BRICK_HEIGHT,
            status: 1,
            color: r < 3 ? '#ff4444' : '#cccccc'
          }
        }
      }
      return bricks
    }

    let bricks = createBricks()

    function drawMetallicBrick(x: number, y: number, width: number, height: number, color: string) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, width, height)
      
      // Add metallic effect
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, 'rgba(255,255,255,0.2)')
      gradient.addColorStop(0.5, 'rgba(255,255,255,0)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.2)')
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, width, height)
      
      // Add border
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.strokeRect(x, y, width, height)
    }

    function drawBall() {
      ctx.beginPath()
      ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.stroke()
      ctx.closePath()
    }

    function drawPaddle() {
      const currentPaddleWidth = isExpanded ? PADDLE_WIDTH * 1.5 : PADDLE_WIDTH
      
      // Draw metallic paddle
      const gradient = ctx.createLinearGradient(paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, paddleX, CANVAS_HEIGHT)
      gradient.addColorStop(0, '#4488ff')
      gradient.addColorStop(0.5, '#2266dd')
      gradient.addColorStop(1, '#1144aa')
      
      ctx.fillStyle = gradient
      ctx.fillRect(paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, currentPaddleWidth, PADDLE_HEIGHT)
      
      // Add metallic shine
      const shineGradient = ctx.createLinearGradient(paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, paddleX, CANVAS_HEIGHT)
      shineGradient.addColorStop(0, 'rgba(255,255,255,0.4)')
      shineGradient.addColorStop(0.5, 'rgba(255,255,255,0)')
      ctx.fillStyle = shineGradient
      ctx.fillRect(paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT, currentPaddleWidth, PADDLE_HEIGHT / 2)
    }

    function drawBricks() {
      for (let c = 0; c < BRICK_COLUMNS; c++) {
        for (let r = 0; r < BRICK_ROWS; r++) {
          if (bricks[c][r].status === 1) {
            drawMetallicBrick(
              bricks[c][r].x,
              bricks[c][r].y,
              bricks[c][r].width,
              bricks[c][r].height,
              bricks[c][r].color
            )
          }
        }
      }
    }

    function drawScore() {
      // Draw metallic score display
      ctx.fillStyle = '#333333'
      ctx.fillRect(10, 10, 120, 30)
      ctx.strokeStyle = '#666666'
      ctx.strokeRect(10, 10, 120, 30)
      
      ctx.font = '16px "Courier New"'
      ctx.fillStyle = '#ffff00'
      ctx.fillText(`${score}`, 20, 30)
      
      // Draw high score
      ctx.fillStyle = '#666666'
      ctx.fillText(`HI: ${highScore}`, 80, 30)
    }

    function drawLives() {
      ctx.fillStyle = '#333333'
      ctx.fillRect(CANVAS_WIDTH - 130, 10, 120, 30)
      ctx.strokeStyle = '#666666'
      ctx.strokeRect(CANVAS_WIDTH - 130, 10, 120, 30)
      
      for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#ff4444'
        ctx.beginPath()
        ctx.arc(CANVAS_WIDTH - 110 + (i * 20), 25, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawPowerUps() {
      powerUps.forEach((powerUp, index) => {
        const x = CANVAS_WIDTH - 40
        const y = 50 + (index * 30)
        
        ctx.fillStyle = '#333333'
        ctx.fillRect(x - 10, y - 10, 40, 25)
        ctx.strokeStyle = '#666666'
        ctx.strokeRect(x - 10, y - 10, 40, 25)
        
        ctx.font = '12px "Courier New"'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(`${powerUp.count}`, x + 15, y + 5)
        
        // Draw power-up icon
        ctx.fillStyle = powerUp.type === 'missile' ? '#ff4444' : '#4488ff'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    function collisionDetection() {
      for (let c = 0; c < BRICK_COLUMNS; c++) {
        for (let r = 0; r < BRICK_ROWS; r++) {
          const b = bricks[c][r]
          if (b.status === 1) {
            if (
              ballX > b.x &&
              ballX < b.x + BRICK_WIDTH &&
              ballY > b.y &&
              ballY < b.y + BRICK_HEIGHT
            ) {
              ballDY = -ballDY
              b.status = 0
              setScore(prev => {
                const newScore = prev + 10
                if (newScore > highScore) {
                  setHighScore(newScore)
                }
                return newScore
              })
              
              // Random power-up drop
              if (Math.random() < 0.1) {
                setPowerUps(prev => 
                  prev.map(p => 
                    p.type === (Math.random() > 0.5 ? 'missile' : 'expand')
                      ? { ...p, count: p.count + 1 }
                      : p
                  )
                )
              }
            }
          }
        }
      }
    }

    function handleTouch(e: TouchEvent) {
      const touch = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left
      
      if (e.type === 'touchstart') {
        setTouchStartX(x)
      } else if (e.type === 'touchmove') {
        const dx = x - touchStartX
        paddleX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, paddleX + dx))
        setTouchStartX(x)
      }
    }

    function draw() {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      
      // Draw metallic background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      bgGradient.addColorStop(0, '#222222')
      bgGradient.addColorStop(1, '#111111')
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      
      drawBricks()
      drawBall()
      drawPaddle()
      drawScore()
      drawLives()
      drawPowerUps()
      collisionDetection()

      if (ballX + ballDX > CANVAS_WIDTH - BALL_RADIUS || ballX + ballDX < BALL_RADIUS) {
        ballDX = -ballDX
      }
      if (ballY + ballDY < BALL_RADIUS) {
        ballDY = -ballDY
      } else if (ballY + ballDY > CANVAS_HEIGHT - BALL_RADIUS) {
        if (ballX > paddleX && ballX < paddleX + (isExpanded ? PADDLE_WIDTH * 1.5 : PADDLE_WIDTH)) {
          ballDY = -ballDY
          // Add angle based on where the ball hits the paddle
          const hitPoint = (ballX - paddleX) / PADDLE_WIDTH
          ballDX = BALL_SPEED * (hitPoint - 0.5) * 2
        } else {
          setLives(prev => prev - 1)
          if (lives <= 1) {
            setGameOver(true)
            setGameStarted(false)
            return
          } else {
            ballX = CANVAS_WIDTH / 2
            ballY = CANVAS_HEIGHT - 30
            ballDX = BALL_SPEED
            ballDY = -BALL_SPEED
            paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2
          }
        }
      }

      ballX += ballDX
      ballY += ballDY

      if (gameStarted) {
        requestAnimationFrame(draw)
      }
    }

    canvas.addEventListener('touchstart', handleTouch)
    canvas.addEventListener('touchmove', handleTouch)
    canvas.addEventListener('touchend', () => setTouchStartX(0))

    if (gameStarted) {
      draw()
    }

    return () => {
      canvas.removeEventListener('touchstart', handleTouch)
      canvas.removeEventListener('touchmove', handleTouch)
      canvas.removeEventListener('touchend', () => setTouchStartX(0))
    }
  }, [gameStarted, lives, score, highScore, powerUps])

  return (
    <div className="flex flex-col items-center">
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT} 
        className="touch-none"
      />
      {!gameStarted && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Brickbreaker</h2>
            <button
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              onClick={() => setGameStarted(true)}
            >
              Tap to Start
            </button>
          </div>
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Game Over</h2>
            <div className="text-white">Score: {score}</div>
            <div className="text-white">High Score: {highScore}</div>
            <button
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              onClick={() => {
                setGameOver(false)
                setGameStarted(true)
                setScore(0)
                setLives(3)
                setPowerUps([
                  { type: 'missile', count: 0 },
                  { type: 'expand', count: 3 }
                ])
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
