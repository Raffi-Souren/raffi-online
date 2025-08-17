'use client'

import { useEffect, useRef, useState } from 'react'

const GAME_WIDTH = 220
const GAME_HEIGHT = 176
const PLAYER_SIZE = 10
const HELICOPTER_SIZE = 20
const MISSILE_SPEED = 2
const PLAYER_SPEED = 1.5

interface GameObject {
  x: number
  y: number
  active: boolean
}

export default function ParachuteGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let player = {
      x: GAME_WIDTH / 2,
      y: 20,
      falling: true
    }

    let helicopters: GameObject[] = []
    let missiles: GameObject[] = []
    let animationFrameId: number

    function spawnHelicopter() {
      if (helicopters.length < 3) {
        helicopters.push({
          x: Math.random() * (GAME_WIDTH - HELICOPTER_SIZE),
          y: GAME_HEIGHT - HELICOPTER_SIZE,
          active: true
        })
      }
    }

    function fireMissile(helicopter: GameObject) {
      missiles.push({
        x: helicopter.x + HELICOPTER_SIZE / 2,
        y: helicopter.y,
        active: true
      })
    }

    function drawPlayer(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = '#000'
      // Draw parachute
      ctx.beginPath()
      ctx.arc(player.x, player.y - 10, 8, Math.PI, 0)
      ctx.stroke()
      // Draw person
      ctx.fillRect(player.x - PLAYER_SIZE/2, player.y, PLAYER_SIZE, PLAYER_SIZE)
    }

    function drawHelicopter(ctx: CanvasRenderingContext2D, helicopter: GameObject) {
      ctx.fillStyle = '#333'
      ctx.fillRect(helicopter.x, helicopter.y, HELICOPTER_SIZE, HELICOPTER_SIZE/2)
      // Rotor
      ctx.beginPath()
      ctx.moveTo(helicopter.x - 10, helicopter.y)
      ctx.lineTo(helicopter.x + HELICOPTER_SIZE + 10, helicopter.y)
      ctx.stroke()
    }

    function drawMissile(ctx: CanvasRenderingContext2D, missile: GameObject) {
      ctx.fillStyle = '#f00'
      ctx.beginPath()
      ctx.arc(missile.x, missile.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    function checkCollisions() {
      // Check missile collisions
      missiles.forEach(missile => {
        if (
          missile.active &&
          Math.abs(missile.x - player.x) < PLAYER_SIZE &&
          Math.abs(missile.y - player.y) < PLAYER_SIZE
        ) {
          setGameOver(true)
          setGameStarted(false)
        }
      })

      // Check ground collision
      if (player.y + PLAYER_SIZE >= GAME_HEIGHT) {
        setScore(prev => prev + 10)
        player.y = 20
      }
    }

    function update() {
      if (gameStarted && !gameOver) {
        // Update player
        if (player.falling) {
          player.y += PLAYER_SPEED
        }

        // Update missiles
        missiles.forEach(missile => {
          if (missile.active) {
            missile.y -= MISSILE_SPEED
          }
        })

        // Spawn helicopters
        if (Math.random() < 0.02) {
          spawnHelicopter()
        }

        // Fire missiles
        helicopters.forEach(helicopter => {
          if (Math.random() < 0.02) {
            fireMissile(helicopter)
          }
        })

        // Clean up off-screen objects
        missiles = missiles.filter(missile => missile.y > 0)
        helicopters = helicopters.filter(helicopter => helicopter.active)

        checkCollisions()
      }
    }

    function draw() {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      // Draw background
      ctx.fillStyle = '#c6e2ff'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      // Draw game objects
      drawPlayer(ctx)
      helicopters.forEach(helicopter => drawHelicopter(ctx, helicopter))
      missiles.forEach(missile => drawMissile(ctx, missile))

      // Draw score
      ctx.fillStyle = '#000'
      ctx.font = '12px monospace'
      ctx.fillText(`Score: ${score}`, 10, 20)

      update()
      animationFrameId = requestAnimationFrame(draw)
    }

    if (gameStarted) {
      draw()
    }

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [gameStarted, gameOver, score])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
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
              <div className="text-white mb-4">Parachute</div>
            )}
            <button
              className="px-4 py-2 bg-white text-black rounded"
              onClick={() => {
                setGameStarted(true)
                setGameOver(false)
                if (gameOver) setScore(0)
              }}
            >
              {gameOver ? 'Play Again' : 'Start'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
