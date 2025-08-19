"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const GAME_WIDTH = 200
const GAME_HEIGHT = 150
const PLAYER_SIZE = 8
const HELICOPTER_SIZE = 12
const MISSILE_SIZE = 3

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
  const [clouds, setClouds] = useState<Position[]>([])
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})

  const resetGame = useCallback(() => {
    setScore(0)
    setLives(3)
    setAltitude(1000)
    setPlayer({ x: GAME_WIDTH / 2, y: 20 })
    setHelicopters([])
    setMissiles([])
    setClouds([
      { x: 50, y: 30 },
      { x: 120, y: 45 },
      { x: 30, y: 60 },
      { x: 150, y: 75 },
    ])
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
        let newY = prev.y + 0.5 // Falling speed

        if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
          newX = Math.max(0, prev.x - 1)
        }
        if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
          newX = Math.min(GAME_WIDTH - PLAYER_SIZE, prev.x + 1)
        }

        // Check if landed
        if (newY >= GAME_HEIGHT - 20) {
          setScore((prev) => prev + 100)
          setAltitude(1000)
          newY = 20
          newX = GAME_WIDTH / 2
        }

        return { x: newX, y: newY }
      })

      // Update altitude
      setAltitude((prev) => Math.max(0, prev - 1))

      // Spawn helicopters
      setHelicopters((prev) => {
        const newHelicopters = [...prev]

        if (Math.random() < 0.02 && newHelicopters.length < 3) {
          const side = Math.random() < 0.5 ? -HELICOPTER_SIZE : GAME_WIDTH
          newHelicopters.push({
            x: side,
            y: Math.random() * (GAME_HEIGHT - 40) + 20,
            direction: side < 0 ? 1 : -1,
            lastShot: Date.now(),
          })
        }

        return newHelicopters
          .map((heli) => ({
            ...heli,
            x: heli.x + heli.direction * 0.5,
          }))
          .filter((heli) => heli.x > -HELICOPTER_SIZE && heli.x < GAME_WIDTH + HELICOPTER_SIZE)
      })

      // Spawn missiles
      setMissiles((prev) => {
        const newMissiles = [...prev]

        helicopters.forEach((heli) => {
          if (Date.now() - heli.lastShot > 2000 && Math.random() < 0.1) {
            heli.lastShot = Date.now()
            newMissiles.push({
              x: heli.x + HELICOPTER_SIZE / 2,
              y: heli.y + HELICOPTER_SIZE,
              vx: (Math.random() - 0.5) * 2,
              vy: 2,
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
    }, 50)

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

      if (gameState === "start" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
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

    // Clear canvas with sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT)
    gradient.addColorStop(0, "#87CEEB")
    gradient.addColorStop(1, "#E0F6FF")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw ground
    ctx.fillStyle = "#8B4513"
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20)

    if (gameState === "start") {
      ctx.fillStyle = "#000000"
      ctx.font = "12px monospace"
      ctx.textAlign = "center"
      ctx.fillText("PARACHUTE", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20)
      ctx.font = "8px monospace"
      ctx.fillText("Use ← → arrows to steer", GAME_WIDTH / 2, GAME_HEIGHT / 2)
      ctx.fillText("Avoid helicopters and missiles!", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15)
      return
    }

    // Draw clouds
    ctx.fillStyle = "#FFFFFF"
    clouds.forEach((cloud) => {
      ctx.beginPath()
      ctx.arc(cloud.x, cloud.y, 8, 0, Math.PI * 2)
      ctx.arc(cloud.x + 8, cloud.y, 10, 0, Math.PI * 2)
      ctx.arc(cloud.x + 16, cloud.y, 8, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw helicopters
    ctx.fillStyle = "#333333"
    helicopters.forEach((heli) => {
      // Helicopter body
      ctx.fillRect(heli.x, heli.y + 4, HELICOPTER_SIZE, 4)
      // Rotor
      ctx.fillRect(heli.x - 2, heli.y, HELICOPTER_SIZE + 4, 2)
      // Tail
      ctx.fillRect(heli.x + HELICOPTER_SIZE, heli.y + 6, 4, 1)
    })

    // Draw missiles
    ctx.fillStyle = "#FF4500"
    missiles.forEach((missile) => {
      ctx.fillRect(missile.x, missile.y, MISSILE_SIZE, MISSILE_SIZE * 2)
    })

    // Draw player with parachute
    ctx.fillStyle = "#FF0000"
    // Parachute canopy
    ctx.beginPath()
    ctx.arc(player.x + PLAYER_SIZE / 2, player.y - 5, 12, 0, Math.PI)
    ctx.fill()

    // Parachute lines
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(player.x + PLAYER_SIZE / 2 - 8, player.y - 5)
    ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y)
    ctx.moveTo(player.x + PLAYER_SIZE / 2 + 8, player.y - 5)
    ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y)
    ctx.stroke()

    // Player body
    ctx.fillStyle = "#0000FF"
    ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE)

    // Draw UI
    ctx.fillStyle = "#000000"
    ctx.font = "10px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`Score: ${score}`, 5, 15)
    ctx.fillText(`Lives: ${lives}`, 5, 25)
    ctx.textAlign = "right"
    ctx.fillText(`Alt: ${altitude}ft`, GAME_WIDTH - 5, 15)

    if (gameState === "gameOver") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "12px monospace"
      ctx.textAlign = "center"
      ctx.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10)
      ctx.font = "8px monospace"
      ctx.fillText(`Final Score: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5)
    }
  }, [gameState, player, helicopters, missiles, clouds, score, lives, altitude])

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
