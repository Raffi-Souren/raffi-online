"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Position {
  x: number
  y: number
}

interface Helicopter {
  x: number
  y: number
  direction: number
}

interface Missile {
  x: number
  y: number
}

type GameState = "START" | "PLAYING" | "GAME_OVER"

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 500
const PLAYER_SIZE = 8
const HELICOPTER_WIDTH = 20
const HELICOPTER_HEIGHT = 8
const MISSILE_SIZE = 4
const GROUND_Y = CANVAS_HEIGHT - 40

export default function ParachuteGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>("START")
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [player, setPlayer] = useState<Position>({ x: CANVAS_WIDTH / 2, y: 50 })
  const [helicopters, setHelicopters] = useState<Helicopter[]>([])
  const [missiles, setMissiles] = useState<Missile[]>([])
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const helicopterSpawnRef = useRef<NodeJS.Timeout>()

  // Start game
  const startGame = useCallback(() => {
    setGameState("PLAYING")
    setScore(0)
    setLives(3)
    setPlayer({ x: CANVAS_WIDTH / 2, y: 50 })
    setHelicopters([])
    setMissiles([])
  }, [])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === "START" || gameState === "GAME_OVER") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          startGame()
        }
      } else {
        setKeys((prev) => ({ ...prev, [e.key]: true }))
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

  // Mobile controls
  const [mobileControls, setMobileControls] = useState({ left: false, right: false })

  const handleMobileStart = () => {
    if (gameState === "START" || gameState === "GAME_OVER") {
      startGame()
    }
  }

  const handleMobileLeft = (pressed: boolean) => {
    setMobileControls((prev) => ({ ...prev, left: pressed }))
  }

  const handleMobileRight = (pressed: boolean) => {
    setMobileControls((prev) => ({ ...prev, right: pressed }))
  }

  // Spawn helicopters
  useEffect(() => {
    if (gameState !== "PLAYING") return

    helicopterSpawnRef.current = setInterval(() => {
      setHelicopters((prev) => [
        ...prev,
        {
          x: Math.random() < 0.5 ? -HELICOPTER_WIDTH : CANVAS_WIDTH + HELICOPTER_WIDTH,
          y: Math.random() * 100 + 50,
          direction: Math.random() < 0.5 ? 1 : -1,
        },
      ])
    }, 2000)

    return () => {
      if (helicopterSpawnRef.current) {
        clearInterval(helicopterSpawnRef.current)
      }
    }
  }, [gameState])

  // Game loop
  useEffect(() => {
    if (gameState !== "PLAYING") return

    gameLoopRef.current = setInterval(() => {
      // Move player
      setPlayer((prev) => {
        let newX = prev.x
        const newY = prev.y + 1.5 // Falling speed

        // Handle controls
        if (keys["ArrowLeft"] || keys["4"] || mobileControls.left) {
          newX -= 2
        }
        if (keys["ArrowRight"] || keys["6"] || mobileControls.right) {
          newX += 2
        }

        // Keep player in bounds
        newX = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_SIZE, newX))

        // Check if landed
        if (newY >= GROUND_Y - PLAYER_SIZE) {
          setScore((prev) => prev + 10)
          return { x: CANVAS_WIDTH / 2, y: 50 } // Reset to top
        }

        return { x: newX, y: newY }
      })

      // Move helicopters and spawn missiles
      setHelicopters((prev) => {
        const newHelicopters = prev
          .map((heli) => ({
            ...heli,
            x: heli.x + heli.direction * 1.5,
          }))
          .filter((heli) => heli.x > -50 && heli.x < CANVAS_WIDTH + 50)

        // Randomly spawn missiles
        newHelicopters.forEach((heli) => {
          if (Math.random() < 0.02) {
            setMissiles((prevMissiles) => [
              ...prevMissiles,
              { x: heli.x + HELICOPTER_WIDTH / 2, y: heli.y + HELICOPTER_HEIGHT },
            ])
          }
        })

        return newHelicopters
      })

      // Move missiles
      setMissiles((prev) =>
        prev.map((missile) => ({ ...missile, y: missile.y + 3 })).filter((missile) => missile.y < CANVAS_HEIGHT),
      )

      // Check missile collisions
      setMissiles((prevMissiles) => {
        const newMissiles = prevMissiles.filter((missile) => {
          const hit =
            missile.x < player.x + PLAYER_SIZE &&
            missile.x + MISSILE_SIZE > player.x &&
            missile.y < player.y + PLAYER_SIZE &&
            missile.y + MISSILE_SIZE > player.y

          if (hit) {
            setLives((prevLives) => {
              const newLives = prevLives - 1
              if (newLives <= 0) {
                setGameState("GAME_OVER")
              }
              return newLives
            })
            setPlayer({ x: CANVAS_WIDTH / 2, y: 50 }) // Reset position
            return false
          }
          return true
        })

        return newMissiles
      })
    }, 16)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, keys, mobileControls, player])

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas with iPod green background
    ctx.fillStyle = "#9BBB58"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (gameState === "START") {
      // Draw start screen
      ctx.fillStyle = "#000"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Parachute", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60)

      ctx.font = "16px monospace"
      ctx.fillText("Avoid the missiles!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
      ctx.fillText("Use ← → to steer", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText("Land safely to score", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)

      ctx.font = "14px monospace"
      ctx.fillText("Press SPACE to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60)
    } else if (gameState === "GAME_OVER") {
      // Draw game over screen
      ctx.fillStyle = "#000"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

      ctx.font = "18px monospace"
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)

      ctx.font = "14px monospace"
      ctx.fillText("Press SPACE to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
    } else {
      // Draw ground
      ctx.fillStyle = "#2d5016"
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)

      // Draw player with parachute
      ctx.fillStyle = "#000"
      // Parachute canopy
      ctx.beginPath()
      ctx.arc(player.x + PLAYER_SIZE / 2, player.y - 10, 15, 0, Math.PI)
      ctx.fill()
      // Parachute lines
      ctx.beginPath()
      ctx.moveTo(player.x - 10, player.y - 10)
      ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y)
      ctx.moveTo(player.x + PLAYER_SIZE + 10, player.y - 10)
      ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y)
      ctx.stroke()
      // Player
      ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE)

      // Draw helicopters
      helicopters.forEach((heli) => {
        ctx.fillStyle = "#000"
        // Helicopter body
        ctx.fillRect(heli.x, heli.y, HELICOPTER_WIDTH, HELICOPTER_HEIGHT)
        // Rotor
        ctx.fillRect(heli.x - 5, heli.y - 2, HELICOPTER_WIDTH + 10, 2)
        // Tail
        ctx.fillRect(heli.x + HELICOPTER_WIDTH, heli.y + 2, 8, 4)
      })

      // Draw missiles
      ctx.fillStyle = "#000"
      missiles.forEach((missile) => {
        ctx.fillRect(missile.x, missile.y, MISSILE_SIZE, MISSILE_SIZE)
      })
    }

    // Draw UI
    ctx.fillStyle = "#000"
    ctx.font = "bold 16px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`Score: ${score}`, 10, 25)
    ctx.fillText(`Lives: ${"♥".repeat(lives)}`, 10, 45)
  }, [gameState, player, helicopters, missiles, score, lives])

  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-400"
        style={{
          imageRendering: "pixelated",
          transform: "scale(1.2)",
          transformOrigin: "center",
        }}
      />

      {/* Mobile Controls */}
      <div className="md:hidden flex flex-col items-center space-y-4">
        {(gameState === "START" || gameState === "GAME_OVER") && (
          <button
            onTouchStart={handleMobileStart}
            onClick={handleMobileStart}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold text-lg touch-manipulation"
          >
            {gameState === "START" ? "START GAME" : "PLAY AGAIN"}
          </button>
        )}

        {gameState === "PLAYING" && (
          <div className="flex space-x-8">
            <button
              onTouchStart={() => handleMobileLeft(true)}
              onTouchEnd={() => handleMobileLeft(false)}
              onMouseDown={() => handleMobileLeft(true)}
              onMouseUp={() => handleMobileLeft(false)}
              onMouseLeave={() => handleMobileLeft(false)}
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white px-6 py-4 rounded-lg font-bold text-xl touch-manipulation"
            >
              ← LEFT
            </button>
            <button
              onTouchStart={() => handleMobileRight(true)}
              onTouchEnd={() => handleMobileRight(false)}
              onMouseDown={() => handleMobileRight(true)}
              onMouseUp={() => handleMobileRight(false)}
              onMouseLeave={() => handleMobileRight(false)}
              className="bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white px-6 py-4 rounded-lg font-bold text-xl touch-manipulation"
            >
              RIGHT →
            </button>
          </div>
        )}
      </div>

      {/* Desktop Start Button */}
      {(gameState === "START" || gameState === "GAME_OVER") && (
        <button
          onClick={startGame}
          className="hidden md:block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold"
        >
          {gameState === "START" ? "Start Game" : "Play Again"}
        </button>
      )}
    </div>
  )
}
