"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Leaderboard from "./Leaderboard"
import LevelSelector from "./LevelSelector"
import GameControls from "./GameControls"
import GameOverScreen from "./GameOverScreen"
import { BRICKBREAKER_LEVELS, loadGameProgress, saveGameProgress, type GameProgress } from "@/lib/game-utils"

const getCanvasDimensions = () => {
  if (typeof window !== "undefined") {
    const isMobile = window.innerWidth < 640
    return {
      width: isMobile ? Math.min(window.innerWidth - 32, 340) : 380,
      height: isMobile ? Math.min(window.innerWidth - 32, 340) * 1.6 : 600,
    }
  }
  return { width: 380, height: 600 }
}

const PADDLE_WIDTH_RATIO = 0.2
const PADDLE_HEIGHT = 10
const BALL_RADIUS = 5
const BRICK_COLUMNS = 10
const BRICK_PADDING = 2

interface Brick {
  x: number
  y: number
  width: number
  height: number
  status: number
  color: string
  points: number
  hits: number
  maxHits: number
}

type GameView = "menu" | "playing" | "paused" | "gameover" | "levelcomplete" | "leaderboard" | "levelselect"

export default function Brickbreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState(getCanvasDimensions())
  const [gameView, setGameView] = useState<GameView>("menu")
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [progress, setProgress] = useState<GameProgress | null>(null)

  const CANVAS_WIDTH = dimensions.width
  const CANVAS_HEIGHT = dimensions.height
  const PADDLE_WIDTH = CANVAS_WIDTH * PADDLE_WIDTH_RATIO
  const BRICK_HEIGHT = CANVAS_HEIGHT * 0.035

  // Load progress on mount
  useEffect(() => {
    setProgress(loadGameProgress("brickbreaker"))
  }, [])

  const gameStateRef = useRef({
    paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT - 60,
    ballDX: 0,
    ballDY: 0,
    bricks: [] as Brick[][],
    animationId: null as number | null,
    keys: {} as Record<string, boolean>,
    lastComboTime: 0,
  })

  const getLevelConfig = (lvl: number) => {
    return BRICKBREAKER_LEVELS[Math.min(lvl - 1, BRICKBREAKER_LEVELS.length - 1)]
  }

  const createBricks = useCallback(
    (currentLevel: number) => {
      const bricks: Brick[][] = []
      const config = getLevelConfig(currentLevel)
      const colors = ["#FF0000", "#FF8800", "#FFFF00", "#00FF00", "#0088FF", "#0000FF", "#8800FF", "#FF00FF"]
      const BRICK_WIDTH = (CANVAS_WIDTH - (BRICK_COLUMNS + 1) * BRICK_PADDING) / BRICK_COLUMNS

      for (let c = 0; c < BRICK_COLUMNS; c++) {
        bricks[c] = []
        for (let r = 0; r < config.rows; r++) {
          const brickX = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_PADDING
          const brickY = r * (BRICK_HEIGHT + BRICK_PADDING) + 60
          const hitsRequired = r < 2 && currentLevel > 3 ? 2 : 1
          bricks[c][r] = {
            x: brickX,
            y: brickY,
            width: BRICK_WIDTH,
            height: BRICK_HEIGHT,
            status: 1,
            color: colors[r % colors.length],
            points: (config.rows - r) * 10,
            hits: hitsRequired,
            maxHits: hitsRequired,
          }
        }
      }
      return bricks
    },
    [CANVAS_WIDTH, BRICK_HEIGHT],
  )

  useEffect(() => {
    const handleResize = () => setDimensions(getCanvasDimensions())
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Timer effect
  useEffect(() => {
    if (gameView !== "playing") return
    const timer = setInterval(() => setTimeElapsed((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [gameView])

  const initializeGame = useCallback(
    (startLevel: number) => {
      const config = getLevelConfig(startLevel)
      const baseSpeed = CANVAS_WIDTH * 0.008 * config.ballSpeed

      gameStateRef.current = {
        paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
        ballX: CANVAS_WIDTH / 2,
        ballY: CANVAS_HEIGHT - 60,
        ballDX: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
        ballDY: -baseSpeed,
        bricks: createBricks(startLevel),
        animationId: null,
        keys: {},
        lastComboTime: 0,
      }
      setScore(0)
      setLives(3)
      setLevel(startLevel)
      setTimeElapsed(0)
      setCombo(0)
      setMaxCombo(0)
    },
    [CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE_WIDTH, createBricks],
  )

  const startGame = (startLevel = 1) => {
    initializeGame(startLevel)
    setGameView("playing")
  }

  const handleLevelComplete = useCallback(() => {
    setGameView("levelcomplete")

    // Update progress
    if (progress) {
      const newProgress = { ...progress }
      newProgress.highScores[level] = Math.max(newProgress.highScores[level] || 0, score)
      newProgress.totalScore += score
      newProgress.gamesPlayed += 1

      // Unlock next level
      if (level < BRICKBREAKER_LEVELS.length && !newProgress.unlockedLevels.includes(level + 1)) {
        newProgress.unlockedLevels.push(level + 1)
      }

      saveGameProgress("brickbreaker", newProgress)
      setProgress(newProgress)
    }
  }, [level, score, progress])

  const handleGameOver = useCallback(() => {
    setGameView("gameover")

    // Update progress
    if (progress) {
      const newProgress = { ...progress }
      newProgress.highScores[level] = Math.max(newProgress.highScores[level] || 0, score)
      newProgress.totalScore += score
      newProgress.gamesPlayed += 1
      saveGameProgress("brickbreaker", newProgress)
      setProgress(newProgress)
    }
  }, [level, score, progress])

  const nextLevel = () => {
    const newLevel = level + 1
    if (newLevel > BRICKBREAKER_LEVELS.length) {
      // Game completed!
      setGameView("gameover")
      return
    }

    const config = getLevelConfig(newLevel)
    const baseSpeed = CANVAS_WIDTH * 0.008 * config.ballSpeed

    gameStateRef.current = {
      ...gameStateRef.current,
      paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
      ballX: CANVAS_WIDTH / 2,
      ballY: CANVAS_HEIGHT - 60,
      ballDX: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
      ballDY: -baseSpeed,
      bricks: createBricks(newLevel),
    }

    setLevel(newLevel)
    setLives((prev) => Math.min(prev + 1, 5))
    setCombo(0)
    setGameView("playing")
  }

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || gameView !== "playing") return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const gameState = gameStateRef.current
    const config = getLevelConfig(level)
    const baseSpeed = CANVAS_WIDTH * 0.008 * config.ballSpeed
    const BRICK_WIDTH = (CANVAS_WIDTH - (BRICK_COLUMNS + 1) * BRICK_PADDING) / BRICK_COLUMNS

    const handleKeyDown = (e: KeyboardEvent) => {
      gameState.keys[e.key] = true
      if (e.key === "Escape") setGameView("paused")
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
      ctx.strokeStyle = "#CCCCCC"
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.closePath()
    }

    const drawPaddle = () => {
      ctx.fillStyle = "#00AAFF"
      ctx.fillRect(gameState.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT - 8, PADDLE_WIDTH, PADDLE_HEIGHT)
      ctx.strokeStyle = "#0088CC"
      ctx.lineWidth = 1
      ctx.strokeRect(gameState.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT - 8, PADDLE_WIDTH, PADDLE_HEIGHT)
    }

    const drawBricks = () => {
      for (let c = 0; c < BRICK_COLUMNS; c++) {
        for (let r = 0; r < gameState.bricks[c]?.length; r++) {
          const brick = gameState.bricks[c][r]
          if (brick.status === 1) {
            ctx.fillStyle = brick.color
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height)

            // Border for definition
            ctx.strokeStyle = "rgba(0, 0, 0, 0.3)"
            ctx.lineWidth = 1
            ctx.strokeRect(brick.x, brick.y, brick.width, brick.height)

            // Highlight for 3D effect
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(brick.x, brick.y + brick.height)
            ctx.lineTo(brick.x, brick.y)
            ctx.lineTo(brick.x + brick.width, brick.y)
            ctx.stroke()

            // Show hit count for multi-hit bricks
            if (brick.maxHits > 1) {
              ctx.fillStyle = "#000000"
              ctx.font = `bold ${Math.floor(BRICK_HEIGHT * 0.6)}px Arial`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillText(brick.hits.toString(), brick.x + brick.width / 2, brick.y + brick.height / 2)
            }
          }
        }
      }
    }

    const collisionDetection = () => {
      const now = Date.now()

      for (let c = 0; c < BRICK_COLUMNS; c++) {
        for (let r = 0; r < gameState.bricks[c]?.length; r++) {
          const brick = gameState.bricks[c][r]
          if (brick.status === 1) {
            if (
              gameState.ballX + BALL_RADIUS > brick.x &&
              gameState.ballX - BALL_RADIUS < brick.x + brick.width &&
              gameState.ballY + BALL_RADIUS > brick.y &&
              gameState.ballY - BALL_RADIUS < brick.y + brick.height
            ) {
              gameState.ballDY = -gameState.ballDY
              brick.hits--

              if (brick.hits <= 0) {
                brick.status = 0

                // Combo system
                if (now - gameState.lastComboTime < 1000) {
                  setCombo((prev) => {
                    const newCombo = prev + 1
                    setMaxCombo((max) => Math.max(max, newCombo))
                    return newCombo
                  })
                } else {
                  setCombo(1)
                }
                gameState.lastComboTime = now

                const comboMultiplier = Math.min(combo + 1, 5)
                setScore((prev) => prev + brick.points * comboMultiplier)
              }

              // Check win condition
              let remainingBricks = 0
              for (let cc = 0; cc < BRICK_COLUMNS; cc++) {
                for (let rr = 0; rr < gameState.bricks[cc]?.length; rr++) {
                  if (gameState.bricks[cc][rr].status === 1) remainingBricks++
                }
              }

              if (remainingBricks === 0) {
                handleLevelComplete()
              }
              return
            }
          }
        }
      }
    }

    const updatePaddle = () => {
      const speed = 8
      if (gameState.keys["ArrowLeft"] || gameState.keys["a"]) {
        gameState.paddleX = Math.max(0, gameState.paddleX - speed)
      }
      if (gameState.keys["ArrowRight"] || gameState.keys["d"]) {
        gameState.paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, gameState.paddleX + speed)
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      drawBricks()
      drawBall()
      drawPaddle()
      collisionDetection()
      updatePaddle()

      // Ball physics
      if (
        gameState.ballX + gameState.ballDX > CANVAS_WIDTH - BALL_RADIUS ||
        gameState.ballX + gameState.ballDX < BALL_RADIUS
      ) {
        gameState.ballDX = -gameState.ballDX
      }
      if (gameState.ballY + gameState.ballDY < BALL_RADIUS) {
        gameState.ballDY = -gameState.ballDY
      } else if (gameState.ballY + gameState.ballDY > CANVAS_HEIGHT - BALL_RADIUS - 8) {
        if (gameState.ballX > gameState.paddleX && gameState.ballX < gameState.paddleX + PADDLE_WIDTH) {
          const hitPoint = (gameState.ballX - gameState.paddleX) / PADDLE_WIDTH
          const angle = (hitPoint - 0.5) * Math.PI * 0.4
          gameState.ballDX = baseSpeed * Math.sin(angle) * 1.2
          gameState.ballDY = -baseSpeed * Math.cos(angle)
          setCombo(0) // Reset combo on paddle hit
        } else {
          setLives((prev) => {
            const newLives = prev - 1
            if (newLives <= 0) {
              handleGameOver()
              return 0
            }
            // Reset ball
            gameState.ballX = CANVAS_WIDTH / 2
            gameState.ballY = CANVAS_HEIGHT - 60
            gameState.ballDX = baseSpeed * (Math.random() > 0.5 ? 1 : -1)
            gameState.ballDY = -baseSpeed
            gameState.paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2
            setCombo(0)
            return newLives
          })
        }
      }

      gameState.ballX += gameState.ballDX
      gameState.ballY += gameState.ballDY

      ctx.fillStyle = "#FFFFFF"
      ctx.font = `${Math.floor(CANVAS_WIDTH * 0.04)}px monospace`
      ctx.textAlign = "left"
      ctx.fillText(`SCORE: ${score}`, 8, 25)
      ctx.fillText(`LIVES: ${lives}`, 8, 45)
      ctx.textAlign = "right"
      ctx.fillText(`LEVEL ${level}`, CANVAS_WIDTH - 8, 25)
      if (combo > 1) {
        ctx.fillStyle = "#FFFF00"
        ctx.fillText(`COMBO x${combo}`, CANVAS_WIDTH - 8, 45)
      }

      if (gameView === "playing") {
        gameState.animationId = requestAnimationFrame(draw)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })

    draw()

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchmove", handleTouchMove)
      if (gameState.animationId) cancelAnimationFrame(gameState.animationId)
    }
  }, [
    gameView,
    level,
    lives,
    score,
    combo,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    PADDLE_WIDTH,
    handleLevelComplete,
    handleGameOver,
  ])

  const isHighScore = progress ? score > (progress.highScores[level] || 0) : false

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto px-2 gap-3">
      {/* Game Controls (visible during play) */}
      {(gameView === "playing" || gameView === "paused") && (
        <GameControls
          isPaused={gameView === "paused"}
          onPause={() => setGameView("paused")}
          onResume={() => setGameView("playing")}
          onRestart={() => startGame(level)}
          onQuit={() => setGameView("menu")}
          score={score}
          level={level}
          lives={lives}
          timeElapsed={timeElapsed}
          showLevelSelect={() => setGameView("levelselect")}
        />
      )}

      {/* Canvas */}
      <div className="relative w-full" style={{ maxWidth: CANVAS_WIDTH }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-gray-700 rounded-lg w-full h-auto"
          style={{ touchAction: "none" }}
        />

        {/* Overlay screens */}
        {gameView === "menu" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 rounded-lg">
            <div className="text-center space-y-4 p-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Brickbreaker</h2>
              <p className="text-gray-400 text-sm">Break all bricks to advance!</p>
              <div className="space-y-2">
                <button
                  className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-400 font-bold min-h-[48px]"
                  onClick={() => startGame(1)}
                >
                  ▶ Start Game
                </button>
                <button
                  className="w-full px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-400 font-bold min-h-[48px]"
                  onClick={() => setGameView("levelselect")}
                >
                  📋 Select Level
                </button>
                <button
                  className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-400 font-bold min-h-[48px]"
                  onClick={() => setGameView("leaderboard")}
                >
                  🏆 Leaderboard
                </button>
              </div>
              <p className="text-gray-500 text-xs">Use mouse/touch or arrow keys to move paddle</p>
            </div>
          </div>
        )}

        {gameView === "paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
            <div className="text-center space-y-4 p-4">
              <h2 className="text-2xl font-bold text-white">PAUSED</h2>
              <p className="text-gray-400">Press ESC or Resume to continue</p>
            </div>
          </div>
        )}

        {gameView === "levelcomplete" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 rounded-lg">
            <div className="text-center space-y-4 p-4">
              <h2 className="text-2xl font-bold text-green-400">Level {level} Complete!</h2>
              <div className="text-white space-y-1">
                <p>
                  Score: <span className="text-yellow-400 font-bold">{score.toLocaleString()}</span>
                </p>
                <p>
                  Max Combo: <span className="text-purple-400 font-bold">{maxCombo}x</span>
                </p>
              </div>
              <div className="space-y-2">
                {level < BRICKBREAKER_LEVELS.length ? (
                  <button
                    className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-400 font-bold"
                    onClick={nextLevel}
                  >
                    Next Level →
                  </button>
                ) : (
                  <div className="text-yellow-400 font-bold text-lg">🎉 You beat all levels! 🎉</div>
                )}
                <button
                  className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 font-bold"
                  onClick={() => setGameView("menu")}
                >
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {gameView === "gameover" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg">
            <GameOverScreen
              score={score}
              level={level}
              isHighScore={isHighScore}
              gameName="brickbreaker"
              onRestart={() => startGame(level)}
              onQuit={() => setGameView("menu")}
              onViewLeaderboard={() => setGameView("leaderboard")}
              stats={{ timeElapsed, maxCombo }}
            />
          </div>
        )}

        {gameView === "leaderboard" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-auto">
            <Leaderboard
              gameName="brickbreaker"
              currentScore={score > 0 ? score : undefined}
              onClose={() => setGameView("menu")}
            />
          </div>
        )}

        {gameView === "levelselect" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-auto">
            <LevelSelector
              gameName="brickbreaker"
              levels={BRICKBREAKER_LEVELS}
              onSelectLevel={(lvl) => startGame(lvl)}
              onClose={() => setGameView("menu")}
            />
          </div>
        )}
      </div>
    </div>
  )
}
