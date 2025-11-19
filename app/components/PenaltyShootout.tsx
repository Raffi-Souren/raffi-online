"use client"

import { useEffect, useRef, useState, useCallback } from "react"

type GameState = "START" | "PLAYING" | "GOAL" | "MISS" | "GAME_OVER"

const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 400
const GOAL_WIDTH = 300
const GOAL_HEIGHT = 150
const BALL_RADIUS = 10

export default function PenaltyShootout() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>("START")
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [ballPos, setBallPos] = useState({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 })
  const [goaliePos, setGoaliePos] = useState({ x: CANVAS_WIDTH / 2, y: 120 })
  const [targetPos, setTargetPos] = useState({ x: CANVAS_WIDTH / 2, y: 120 })
  
  const animationRef = useRef<number>()
  const goalieDirectionRef = useRef(1)
  const ballVelocityRef = useRef({ x: 0, y: 0, scale: 0 })

  const resetBall = () => {
    setBallPos({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 })
    ballVelocityRef.current = { x: 0, y: 0, scale: 0 }
  }

  const shoot = useCallback(() => {
    if (gameState !== "PLAYING") return

    const dx = targetPos.x - ballPos.x
    const dy = targetPos.y - ballPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const speed = 15

    ballVelocityRef.current = {
      x: (dx / distance) * speed,
      y: (dy / distance) * speed,
      scale: 0.02 // Ball gets smaller as it goes away
    }
  }, [gameState, targetPos, ballPos])

  const updateGame = useCallback(() => {
    if (gameState === "PLAYING") {
      // Move goalie
      setGoaliePos(prev => {
        let newX = prev.x + 3 * goalieDirectionRef.current
        if (newX < (CANVAS_WIDTH - GOAL_WIDTH) / 2 + 20 || newX > (CANVAS_WIDTH + GOAL_WIDTH) / 2 - 20) {
          goalieDirectionRef.current *= -1
        }
        return { ...prev, x: newX }
      })

      // Move target
      setTargetPos(prev => {
        // Simple target movement or follow mouse (handled in event listener)
        return prev
      })

      // Move ball if shot
      if (ballVelocityRef.current.x !== 0 || ballVelocityRef.current.y !== 0) {
        setBallPos(prev => {
          const newX = prev.x + ballVelocityRef.current.x
          const newY = prev.y + ballVelocityRef.current.y
          
          // Check collision with goal plane
          if (newY <= 120) {
            // Check if goal or miss or save
            const inGoalX = newX > (CANVAS_WIDTH - GOAL_WIDTH) / 2 && newX < (CANVAS_WIDTH + GOAL_WIDTH) / 2
            const inGoalY = newY > 120 - GOAL_HEIGHT && newY < 120
            
            // Check goalie collision
            const hitGoalie = Math.abs(newX - goaliePos.x) < 30 && Math.abs(newY - goaliePos.y) < 40

            if (hitGoalie) {
              setGameState("MISS")
              setTimeout(() => {
                setAttempts(a => a + 1)
                setGameState("PLAYING")
                resetBall()
              }, 1500)
            } else if (inGoalX && inGoalY) {
              setGameState("GOAL")
              setScore(s => s + 1)
              setTimeout(() => {
                setAttempts(a => a + 1)
                setGameState("PLAYING")
                resetBall()
              }, 1500)
            } else {
              setGameState("MISS")
              setTimeout(() => {
                setAttempts(a => a + 1)
                setGameState("PLAYING")
                resetBall()
              }, 1500)
            }
            
            return prev // Stop ball
          }
          
          return { x: newX, y: newY }
        })
      }
    }
  }, [gameState, goaliePos])

  useEffect(() => {
    const loop = () => {
      updateGame()
      animationRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(animationRef.current!)
  }, [updateGame])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear
    ctx.fillStyle = "#2d5016" // Grass
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw Goal
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 5
    const goalX = (CANVAS_WIDTH - GOAL_WIDTH) / 2
    const goalY = 120 - GOAL_HEIGHT
    ctx.strokeRect(goalX, goalY, GOAL_WIDTH, GOAL_HEIGHT)
    
    // Draw Net
    ctx.strokeStyle = "rgba(255,255,255,0.3)"
    ctx.lineWidth = 1
    for (let i = goalX; i <= goalX + GOAL_WIDTH; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, goalY); ctx.lineTo(i, goalY + GOAL_HEIGHT); ctx.stroke()
    }
    for (let i = goalY; i <= goalY + GOAL_HEIGHT; i += 20) {
      ctx.beginPath(); ctx.moveTo(goalX, i); ctx.lineTo(goalX + GOAL_WIDTH, i); ctx.stroke()
    }

    // Draw Goalie
    ctx.fillStyle = "#ff0000"
    ctx.fillRect(goaliePos.x - 20, goaliePos.y - 40, 40, 80)
    
    // Draw Ball
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    let currentRadius = BALL_RADIUS
    if (ballVelocityRef.current.x !== 0) {
      // Perspective effect
      const dist = (ballPos.y - 120) / (CANVAS_HEIGHT - 50 - 120)
      currentRadius = BALL_RADIUS * (0.5 + 0.5 * dist)
    }
    ctx.arc(ballPos.x, ballPos.y, currentRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 1
    ctx.stroke()

    // Draw Target (if playing and ball not moving)
    if (gameState === "PLAYING" && ballVelocityRef.current.x === 0) {
      ctx.strokeStyle = "rgba(255, 255, 0, 0.7)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(targetPos.x, targetPos.y, 15, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(targetPos.x - 20, targetPos.y)
      ctx.lineTo(targetPos.x + 20, targetPos.y)
      ctx.moveTo(targetPos.x, targetPos.y - 20)
      ctx.lineTo(targetPos.x, targetPos.y + 20)
      ctx.stroke()
    }

    // UI
    if (gameState === "GOAL") {
      ctx.fillStyle = "yellow"
      ctx.font = "bold 48px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("GOAL!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    } else if (gameState === "MISS") {
      ctx.fillStyle = "red"
      ctx.font = "bold 48px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("MISS!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    }

  }, [gameState, ballPos, goaliePos, targetPos])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== "PLAYING") return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    // Limit target to goal area
    setTargetPos({ x, y })
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== "PLAYING") return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height
    const x = (e.touches[0].clientX - rect.left) * scaleX
    const y = (e.touches[0].clientY - rect.top) * scaleY
    setTargetPos({ x, y })
  }

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div className="relative w-full max-w-[600px] aspect-[3/2] bg-green-800 rounded-lg overflow-hidden border-4 border-white shadow-lg">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full"
          style={{ touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onClick={shoot}
          onTouchEnd={shoot}
        />
        
        {gameState === "START" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <button 
              onClick={() => setGameState("PLAYING")}
              className="bg-white text-black px-8 py-4 rounded-full font-bold text-xl hover:scale-105 transition-transform"
            >
              START KICKOFF
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between w-full max-w-[600px] px-4 font-mono text-white bg-black/80 p-2 rounded">
        <div>SCORE: {score}</div>
        <div>ATTEMPTS: {attempts}</div>
      </div>
      
      <div className="text-sm text-gray-300">
        Aim with mouse/touch • Click/Tap to Shoot
      </div>
    </div>
  )
}
