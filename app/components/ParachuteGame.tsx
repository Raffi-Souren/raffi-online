"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const GAME_WIDTH = 200
const GAME_HEIGHT = 150
const PLAYER_SIZE = 6
const HELICOPTER_SIZE = 10
const MISSILE_SIZE = 2

interface Position {
  x: number
  y: number
}

interface Helicopter {
  x: number
  y: number
  direction: number
  lastShot: number
}

interface Missile {
  x: number
  y: number
  vx: number
  vy: number
}

export default function ParachuteGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<"start" | "playing" | "gameOver">("start")
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [altitude, setAltitude] = useState(1000)
  const [player, setPlayer] = useState<Position>({ x: GAME_WIDTH / 2, y: 20 })
  const [helicopters, setHelicopters] = useState<Helicopter[]>([])
  const [missiles, setMissiles] = useState<Missile[]>([])
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})

  const resetGame = useCallback(() => {
    setScore(0)
    setLives(3)
    setAltitude(1000)
    setPlayer({ x: GAME_WIDTH / 2, y: 20 })
    setHelicopters([])
    setMissiles([])
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    setGameState("playing")
  }, [resetGame])

  const gameOver = useCallback(() => {
    setGameState("gameOver")
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") return

    gameLoopRef.current = setInterval(() => {
      // Move player
      setPlayer((prev) => {
        let newX = prev.x
        let newY = prev.y + 0.8 // Falling speed

        if (keys["ArrowLeft"] || keys["4"]) {
          newX = Math.max(PLAYER_SIZE, prev.x - 1.5)
        }
        if (keys["ArrowRight"] || keys["6"]) {
          newX = Math.min(GAME_WIDTH - PLAYER_SIZE, prev.x + 1.5)
        }

        // Check if landed
        if (newY >= GAME_HEIGHT - 15) {
          setScore((prev) => prev + 100)
          setAltitude(1000)
          newY = 20
          newX = GAME_WIDTH / 2
        }

        return { x: newX, y: newY }
      })

      // Update altitude
      setAltitude((prev) => Math.max(0, prev - 2))

      // Spawn helicopters
      setHelicopters((prev) => {
        const newHelicopters = [...prev]

        if (Math.random() < 0.025 && newHelicopters.length < 2) {
          const side = Math.random() < 0.5 ? -HELICOPTER_SIZE : GAME_WIDTH
          newHelicopters.push({
            x: side,
            y: Math.random() * (GAME_HEIGHT - 60) + 30,
            direction: side < 0 ? 1 : -1,
            lastShot: Date.now(),
          })
        }

        return newHelicopters
          .map((heli) => ({
            ...heli,
            x: heli.x + heli.direction * 0.8,
          }))
          .filter((heli) => heli.x > -HELICOPTER_SIZE && heli.x < GAME_WIDTH + HELICOPTER_SIZE)
      })

      // Spawn missiles
      setMissiles((prev) => {
        const newMissiles = [...prev]

        helicopters.forEach((heli) => {
          if (Date.now() - heli.lastShot > 1800 && Math.random() < 0.15) {
            heli.lastShot = Date.now()
            newMissiles.push({
              x: heli.x + HELICOPTER_SIZE / 2,
              y: heli.y + HELICOPTER_SIZE,
              vx: (Math.random() - 0.5) * 1.5,
              vy: 1.8,
            })
          }
        })

        return newMissiles
          .map((missile) => ({
            ...missile,
            x: missile.x + missile.vx,
            y: missile.y + missile.vy,
          }))
          .filter((missile) => missile.x > 0 && missile.x < GAME_WIDTH && missile.y > 0 && missile.y < GAME_HEIGHT)
      })

      // Check missile collisions
      setMissiles((currentMissiles) => {
        const hitMissiles: number[] = []

        currentMissiles.forEach((missile, index) => {
          if (
            missile.x < player.x + PLAYER_SIZE &&
            missile.x + MISSILE_SIZE > player.x &&
            missile.y < player.y + PLAYER_SIZE &&
            missile.y + MISSILE_SIZE > player.y
          ) {
            hitMissiles.push(index)
            setLives((prev) => {
              const newLives = prev - 1
              if (newLives <= 0) {
                setTimeout(gameOver, 100)
              }
              return newLives
            })
          }
        })

        return currentMissiles.filter((_, index) => !hitMissiles.includes(index))
      })
    }, 40)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, keys, player, helicopters, gameOver])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key]: true }))

      if (
        gameState === "start" &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "4" || e.key === "6" || e.key === " ")
      ) {
        startGame()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key]: false }))
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState, startGame])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas with classic iPod green background
    ctx.fillStyle = "#9BBB58"
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw ground
    ctx.fillStyle = "#2D4A22"
    ctx.fillRect(0, GAME_HEIGHT - 15, GAME_WIDTH, 15)

    if (gameState === "start") {
      ctx.fillStyle = "#000000"
      ctx.font = "bold 14px monospace"
      ctx.textAlign = "center"
      ctx.fillText("PARACHUTE", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25)
      ctx.font = "8px monospace"
      ctx.fillText("← → to steer", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 5)
      ctx.fillText("Avoid helicopters!", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8)
      ctx.fillText("Press ← → or SPACE", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25)
      return
    }

    // Draw helicopters (classic iPod style)
    ctx.fillStyle = "#000000"
    helicopters.forEach((heli) => {
      // Helicopter body (simple rectangle)
      ctx.fillRect(heli.x, heli.y + 3, HELICOPTER_SIZE, 3)
      // Rotor (line)
      ctx.fillRect(heli.x - 1, heli.y, HELICOPTER_SIZE + 2, 1)
      // Tail
      ctx.fillRect(heli.x + HELICOPTER_SIZE, heli.y + 4, 3, 1)
    })

    // Draw missiles (simple black dots)
    ctx.fillStyle = "#000000"
    missiles.forEach((missile) => {
      ctx.fillRect(missile.x, missile.y, MISSILE_SIZE, MISSILE_SIZE)
    })

    // Draw player with parachute (classic iPod style)
    ctx.fillStyle = "#000000"

    // Parachute canopy (simple arc)
    ctx.beginPath()
    ctx.arc(player.x + PLAYER_SIZE / 2, player.y - 4, 8, 0, Math.PI)
    ctx.fill()

    // Parachute lines (simple lines)
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(player.x + PLAYER_SIZE / 2 - 6, player.y - 4)
    ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y)
    ctx.moveTo(player.x + PLAYER_SIZE / 2 + 6, player.y - 4)
    ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y)
    ctx.stroke()

    // Player body (simple rectangle)
    ctx.fillStyle = "#000000"
    ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE)

    // Draw UI (classic iPod style)
    ctx.fillStyle = "#000000"
    ctx.font = "bold 8px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`${score}`, 5, 12)
    ctx.fillText(`♥${lives}`, 5, 22)
    ctx.textAlign = "right"
    ctx.fillText(`${altitude}ft`, GAME_WIDTH - 5, 12)

    if (gameState === "gameOver") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "bold 12px monospace"
      ctx.textAlign = "center"
      ctx.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15)
      ctx.font = "8px monospace"
      ctx.fillText(`Score: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2)
      ctx.fillText("Press ← → to restart", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15)
    }
  }, [gameState, player, helicopters, missiles, score, lives, altitude])

  const handleMobileControl = (direction: "left" | "right") => {
    if (gameState === "start") {
      startGame()
    }

    setKeys((prev) => ({
      ...prev,
      ArrowLeft: direction === "left",
      ArrowRight: direction === "right",
    }))

    // Clear the key after a short delay
    setTimeout(() => {
      setKeys((prev) => ({
        ...prev,
        ArrowLeft: false,
        ArrowRight: false,
      }))
    }, 100)
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Game Canvas Container */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="border border-gray-400"
          style={{
            imageRendering: "pixelated",
            width: `${GAME_WIDTH * 2.5}px`,
            height: `${GAME_HEIGHT * 2.5}px`,
            maxWidth: "90%",
            maxHeight: "90%",
          }}
        />
      </div>

      {/* Mobile Controls */}
      <div className="py-4 flex justify-center gap-4 md:hidden">
        <button
          onTouchStart={() => handleMobileControl("left")}
          onMouseDown={() => handleMobileControl("left")}
          className="w-16 h-12 bg-gray-700 text-white rounded flex items-center justify-center text-xl font-bold active:bg-gray-600"
        >
          ←
        </button>
        <button
          onTouchStart={() => handleMobileControl("right")}
          onMouseDown={() => handleMobileControl("right")}
          className="w-16 h-12 bg-gray-700 text-white rounded flex items-center justify-center text-xl font-bold active:bg-gray-600"
        >
          →
        </button>
      </div>

      {/* Game Over Play Again Button */}
      {gameState === "gameOver" && (
        <div className="py-4 flex justify-center">
          <button
            onClick={startGame}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
