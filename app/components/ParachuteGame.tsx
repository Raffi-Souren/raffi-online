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
const PLAYER_SIZE = 12
const HELICOPTER_WIDTH = 30
const HELICOPTER_HEIGHT = 12
const MISSILE_SIZE = 6
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

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (gameState !== "PLAYING") {
      startGame()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const touchX = e.touches[0].clientX - rect.left
    const isLeft = touchX < rect.width / 2
    setMobileControls({ left: isLeft, right: !isLeft })
  }, [gameState, startGame])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setMobileControls({ left: false, right: false })
  }, [])

  // Spawn helicopters
  useEffect(() => {
    if (gameState !== "PLAYING") return

    helicopterSpawnRef.current = setInterval(() => {
      setHelicopters((prev) => [
        ...prev,
        {
          x: Math.random() < 0.5 ? -HELICOPTER_WIDTH : CANVAS_WIDTH + HELICOPTER_WIDTH,
          y: Math.random() * 150 + 50,
          direction: Math.random() < 0.5 ? 1 : -1,
        },
      ])
    }, 1500)

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
        const newY = prev.y + 2 // Falling speed

        // Handle controls
        if (keys["ArrowLeft"] || keys["4"] || mobileControls.left) {
          newX -= 3
        }
        if (keys["ArrowRight"] || keys["6"] || mobileControls.right) {
          newX += 3
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
            x: heli.x + heli.direction * 2,
          }))
          .filter((heli) => heli.x > -50 && heli.x < CANVAS_WIDTH + 50)

        // Randomly spawn missiles
        newHelicopters.forEach((heli) => {
          if (Math.random() < 0.03) {
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
        prev.map((missile) => ({ ...missile, y: missile.y + 4 })).filter((missile) => missile.y < CANVAS_HEIGHT),
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

    // Draw ground
    ctx.fillStyle = "#2d5016"
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)

    if (gameState === "START") {
      // Draw start screen
      ctx.fillStyle = "#000"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("PARACHUTE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60)

      ctx.font = "16px monospace"
      ctx.fillText("Avoid the missiles!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
      ctx.fillText("Tap Left/Right to steer", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.fillText("Land safely to score", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)

      ctx.font = "bold 18px monospace"
      ctx.fillText("TAP TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80)
    } else if (gameState === "GAME_OVER") {
      // Draw game over screen
      ctx.fillStyle = "#000"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

      ctx.font = "18px monospace"
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)

      ctx.font = "bold 18px monospace"
      ctx.fillText("TAP TO RESTART", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60)
    } else {
      // Draw player with parachute
      ctx.fillStyle = "#000"
      // Parachute canopy
      ctx.beginPath()
      ctx.arc(player.x + PLAYER_SIZE / 2, player.y - 10, 15, Math.PI, 0)
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
        ctx.fillRect(heli.x + (heli.direction === 1 ? -5 : HELICOPTER_WIDTH), heli.y + 2, 8, 4)
      })

      // Draw missiles
      ctx.fillStyle = "#000"
      missiles.forEach((missile) => {
        ctx.beginPath()
        ctx.arc(missile.x + MISSILE_SIZE/2, missile.y + MISSILE_SIZE/2, MISSILE_SIZE/2, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Draw UI
    ctx.fillStyle = "#000"
    ctx.font = "bold 16px monospace"
    ctx.textAlign = "left"
    ctx.fillText(`SCORE: ${score}`, 10, 25)
    ctx.fillText(`LIVES: ${"♥".repeat(lives)}`, 10, 45)
  }, [gameState, player, helicopters, missiles, score, lives])

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
      <div className="relative w-full aspect-[4/5] bg-[#9BBB58] border-4 border-gray-700 rounded-lg overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain"
          style={{
            imageRendering: "pixelated",
            touchAction: "none",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={gameState !== "PLAYING" ? startGame : undefined}
        />
        
        {/* Mobile Controls Overlay Hints */}
        {gameState === "PLAYING" && (
          <div className="absolute inset-0 pointer-events-none flex">
            <div className={`w-1/2 h-full transition-opacity duration-200 ${mobileControls.left ? 'bg-black/10' : 'bg-transparent'}`} />
            <div className={`w-1/2 h-full transition-opacity duration-200 ${mobileControls.right ? 'bg-black/10' : 'bg-transparent'}`} />
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600 font-mono text-center">
        <span className="hidden md:inline">Use Arrow Keys to Move • Space to Start</span>
        <span className="md:hidden">Tap Left/Right side of screen to Move</span>
      </div>
    </div>
  )
}
