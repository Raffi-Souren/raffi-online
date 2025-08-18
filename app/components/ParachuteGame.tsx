"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const GAME_WIDTH = 220
const GAME_HEIGHT = 176
const PLAYER_SIZE = 8
const HELICOPTER_SIZE = 16
const MISSILE_SPEED = 2.5
const PLAYER_SPEED = 1.2
const HELICOPTER_SPEED = 0.5

interface GameObject {
  x: number
  y: number
  active: boolean
  vx?: number
}

export default function ParachuteGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameStateRef = useRef({
    player: { x: GAME_WIDTH / 2, y: 20, falling: true, vx: 0 },
    helicopters: [] as GameObject[],
    missiles: [] as GameObject[],
    animationId: null as number | null,
    keys: {} as Record<string, boolean>,
  })
  const [gameStarted, setGameStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [lives, setLives] = useState(3)

  const spawnHelicopter = useCallback(() => {
    const gameState = gameStateRef.current
    if (gameState.helicopters.length < 2 && Math.random() < 0.02) {
      gameState.helicopters.push({
        x: Math.random() > 0.5 ? -HELICOPTER_SIZE : GAME_WIDTH,
        y: GAME_HEIGHT - HELICOPTER_SIZE - 20 - Math.random() * 50,
        active: true,
        vx: Math.random() > 0.5 ? HELICOPTER_SPEED : -HELICOPTER_SPEED,
      })
    }
  }, [])

  const fireMissile = useCallback((helicopter: GameObject) => {
    const gameState = gameStateRef.current
    if (Math.random() < 0.015) {
      gameState.missiles.push({
        x: helicopter.x + HELICOPTER_SIZE / 2,
        y: helicopter.y,
        active: true,
      })
    }
  }, [])

  const checkCollisions = useCallback(() => {
    const gameState = gameStateRef.current

    // Check missile collisions
    gameState.missiles.forEach((missile) => {
      if (
        missile.active &&
        Math.abs(missile.x - gameState.player.x) < PLAYER_SIZE &&
        Math.abs(missile.y - gameState.player.y) < PLAYER_SIZE
      ) {
        setLives((prev) => {
          const newLives = prev - 1
          if (newLives <= 0) {
            setGameOver(true)
            setGameStarted(false)
            return 0
          } else {
            // Reset player position
            gameState.player.x = GAME_WIDTH / 2
            gameState.player.y = 20
            gameState.player.vx = 0
            return newLives
          }
        })
        missile.active = false
      }
    })

    // Check ground collision (successful landing)
    if (gameState.player.y + PLAYER_SIZE >= GAME_HEIGHT - 15) {
      setScore((prev) => prev + 10)
      gameState.player.y = 20
      gameState.player.x = GAME_WIDTH / 2 + (Math.random() - 0.5) * 100
      gameState.player.vx = 0
    }
  }, [])

  const update = useCallback(() => {
    const gameState = gameStateRef.current

    // Update player movement
    if (gameState.keys["ArrowLeft"] || gameState.keys["a"]) {
      gameState.player.vx = Math.max(-2, gameState.player.vx - 0.2)
    }
    if (gameState.keys["ArrowRight"] || gameState.keys["d"]) {
      gameState.player.vx = Math.min(2, gameState.player.vx + 0.2)
    }

    // Apply air resistance
    gameState.player.vx *= 0.95

    // Update player position
    if (gameState.player.falling) {
      gameState.player.y += PLAYER_SPEED
      gameState.player.x += gameState.player.vx
    }

    // Keep player in bounds
    gameState.player.x = Math.max(PLAYER_SIZE, Math.min(GAME_WIDTH - PLAYER_SIZE, gameState.player.x))

    // Update helicopters
    gameState.helicopters.forEach((helicopter) => {
      if (helicopter.active) {
        helicopter.x += helicopter.vx || 0
        // Remove helicopters that go off screen
        if (helicopter.x < -HELICOPTER_SIZE * 2 || helicopter.x > GAME_WIDTH + HELICOPTER_SIZE) {
          helicopter.active = false
        }
      }
    })

    // Update missiles
    gameState.missiles.forEach((missile) => {
      if (missile.active) {
        missile.y -= MISSILE_SPEED
      }
    })

    // Spawn helicopters
    spawnHelicopter()

    // Fire missiles
    gameState.helicopters.forEach((helicopter) => {
      if (helicopter.active) {
        fireMissile(helicopter)
      }
    })

    // Clean up inactive objects
    gameState.missiles = gameState.missiles.filter((missile) => missile.y > 0 && missile.active)
    gameState.helicopters = gameState.helicopters.filter((helicopter) => helicopter.active)

    checkCollisions()
  }, [spawnHelicopter, fireMissile, checkCollisions])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    const gameState = gameStateRef.current

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT)
    skyGradient.addColorStop(0, "#87CEEB")
    skyGradient.addColorStop(1, "#E0F6FF")
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    for (let i = 0; i < 3; i++) {
      const x = (i * 80 + 20) % GAME_WIDTH
      const y = 30 + i * 20
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, Math.PI * 2)
      ctx.arc(x + 15, y, 20, 0, Math.PI * 2)
      ctx.arc(x + 30, y, 15, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw ground
    ctx.fillStyle = "#8B4513"
    ctx.fillRect(0, GAME_HEIGHT - 15, GAME_WIDTH, 15)

    // Draw grass
    ctx.fillStyle = "#228B22"
    ctx.fillRect(0, GAME_HEIGHT - 18, GAME_WIDTH, 3)

    // Draw player with parachute
    ctx.fillStyle = "#000"
    // Draw parachute
    ctx.beginPath()
    ctx.arc(gameState.player.x, gameState.player.y - 10, 12, Math.PI, 0)
    ctx.strokeStyle = "#FF6B6B"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw parachute lines
    ctx.beginPath()
    ctx.moveTo(gameState.player.x - 10, gameState.player.y - 2)
    ctx.lineTo(gameState.player.x, gameState.player.y + 2)
    ctx.moveTo(gameState.player.x + 10, gameState.player.y - 2)
    ctx.lineTo(gameState.player.x, gameState.player.y + 2)
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 1
    ctx.stroke()

    // Draw person
    ctx.fillStyle = "#4169E1"
    ctx.fillRect(gameState.player.x - PLAYER_SIZE / 2, gameState.player.y, PLAYER_SIZE, PLAYER_SIZE)

    // Draw helicopters
    gameState.helicopters.forEach((helicopter) => {
      if (helicopter.active) {
        ctx.fillStyle = "#333"
        ctx.fillRect(helicopter.x, helicopter.y, HELICOPTER_SIZE, HELICOPTER_SIZE / 2)

        // Draw rotor (animated)
        ctx.strokeStyle = "#666"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(helicopter.x - 8, helicopter.y - 2)
        ctx.lineTo(helicopter.x + HELICOPTER_SIZE + 8, helicopter.y - 2)
        ctx.stroke()

        // Draw tail
        ctx.fillStyle = "#333"
        ctx.fillRect(helicopter.x + HELICOPTER_SIZE, helicopter.y + 2, 6, 2)
      }
    })

    // Draw missiles
    gameState.missiles.forEach((missile) => {
      if (missile.active) {
        ctx.fillStyle = "#FF4500"
        ctx.beginPath()
        ctx.arc(missile.x, missile.y, 3, 0, Math.PI * 2)
        ctx.fill()

        // Draw missile trail
        ctx.strokeStyle = "#FF6347"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(missile.x, missile.y)
        ctx.lineTo(missile.x, missile.y + 8)
        ctx.stroke()
      }
    })

    // Draw UI
    ctx.fillStyle = "#000"
    ctx.font = "12px Arial"
    ctx.fillText(`Score: ${score}`, 5, 15)
    ctx.fillText(`Lives: ${lives}`, 5, 30)
    ctx.fillText(`Alt: ${Math.floor((GAME_HEIGHT - gameState.player.y) / 2)}ft`, GAME_WIDTH - 60, 15)

    if (gameStarted && !gameOver) {
      update()
      gameStateRef.current.animationId = requestAnimationFrame(draw)
    }
  }, [gameStarted, gameOver, score, lives, update])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      gameStateRef.current.keys[e.key] = true
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      gameStateRef.current.keys[e.key] = false
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (gameStarted && !gameOver) {
      draw()
    }

    return () => {
      if (gameStateRef.current.animationId) {
        cancelAnimationFrame(gameStateRef.current.animationId)
      }
    }
  }, [gameStarted, gameOver, draw])

  const startGame = () => {
    gameStateRef.current = {
      player: { x: GAME_WIDTH / 2, y: 20, falling: true, vx: 0 },
      helicopters: [],
      missiles: [],
      animationId: null,
      keys: {},
    }
    setGameOver(false)
    setScore(0)
    setLives(3)
    setGameStarted(true)
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="bg-gray-100 border-2 border-gray-600 rounded"
        tabIndex={0}
      />
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded">
          <div className="text-center space-y-4">
            <h2 className="text-lg font-bold text-white">Parachute</h2>
            {gameOver && (
              <>
                <div className="text-red-400">Mission Failed!</div>
                <div className="text-white">Final Score: {score}</div>
              </>
            )}
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-bold"
              onClick={startGame}
            >
              {gameOver ? "Try Again" : "Start Mission"}
            </button>
            <div className="text-white text-xs space-y-1">
              <div>Use arrow keys or A/D to steer</div>
              <div>Avoid missiles and land safely!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
