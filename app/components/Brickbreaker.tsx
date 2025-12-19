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
    const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024

    if (isMobile) {
      // Mobile: use most of screen width, maintain 9:16 aspect ratio
      const maxWidth = Math.min(window.innerWidth - 40, 380)
      return {
        width: maxWidth,
        height: Math.min(maxWidth * 1.58, window.innerHeight - 200),
      }
    } else if (isTablet) {
      // Tablet: medium size
      return {
        width: 400,
        height: 630,
      }
    } else {
      // Desktop: original size
      return {
        width: 380,
        height: 600,
      }
    }
  }
  return { width: 380, height: 600 }
}

const PADDLE_WIDTH_RATIO = 0.2
const PADDLE_HEIGHT = 10
const BALL_RADIUS = 5
const BRICK_COLUMNS = 10
const BRICK_PADDING = 2

type CapsuleType = "long" | "slow" | "multi" | "laser" | "catch" | "life" | "bomb" | "flip"

interface Capsule {
  x: number
  y: number
  dy: number
  type: CapsuleType
  active: boolean
}

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
  unbreakable?: boolean // Added silver unbreakable bricks
  hasCapsule?: CapsuleType | false
}

interface Ball {
  x: number
  y: number
  dx: number
  dy: number
  active: boolean
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
    balls: [] as Ball[], // Support multiple balls for multi-ball capsule
    bricks: [] as Brick[][],
    capsules: [] as Capsule[],
    animationId: null as number | null,
    keys: {} as Record<string, boolean>,
    lastComboTime: 0,
    paddleHits: 0, // Track paddle hits for speed changes
    speedCycle: 0, // Track slow/fast cycles
    activePowerups: new Set<CapsuleType>(),
    laserShots: [] as { x: number; y: number }[],
    caughtBall: null as Ball | null,
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

      const capsuleTypes: CapsuleType[] = ["long", "slow", "multi", "laser", "catch", "life", "bomb", "flip"]

      for (let c = 0; c < BRICK_COLUMNS; c++) {
        bricks[c] = []
        for (let r = 0; r < config.rows; r++) {
          const brickX = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_PADDING
          const brickY = r * (BRICK_HEIGHT + BRICK_PADDING) + 60

          // Add silver unbreakable bricks on higher levels
          const isUnbreakable = currentLevel > 5 && Math.random() < 0.1 && r > 1

          const hitsRequired = isUnbreakable ? 999 : r < config.multiHitRows ? 2 : 1

          // Randomly add capsules to some bricks
          const hasCapsule =
            !isUnbreakable && Math.random() < 0.15
              ? capsuleTypes[Math.floor(Math.random() * capsuleTypes.length)]
              : false

          bricks[c][r] = {
            x: brickX,
            y: brickY,
            width: BRICK_WIDTH,
            height: BRICK_HEIGHT,
            status: 1,
            color: isUnbreakable ? "#C0C0C0" : colors[r % colors.length],
            points: (config.rows - r) * 10,
            hits: hitsRequired,
            maxHits: hitsRequired,
            unbreakable: isUnbreakable,
            hasCapsule,
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
      const baseSpeed = CANVAS_WIDTH * 0.006 * config.ballSpeed // Slower initial speed for authentic feel

      gameStateRef.current = {
        paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
        balls: [
          {
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 60,
            dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
            dy: -baseSpeed,
            active: true,
          },
        ],
        bricks: createBricks(startLevel),
        capsules: [],
        animationId: null,
        keys: {},
        lastComboTime: 0,
        paddleHits: 0,
        speedCycle: 0,
        activePowerups: new Set(),
        laserShots: [],
        caughtBall: null,
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
    const baseSpeed = CANVAS_WIDTH * 0.006 * config.ballSpeed

    gameStateRef.current = {
      ...gameStateRef.current,
      paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
      balls: [
        {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT - 60,
          dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
          dy: -baseSpeed,
          active: true,
        },
      ],
      bricks: createBricks(newLevel),
      capsules: [],
      paddleHits: 0,
      speedCycle: 0,
      activePowerups: new Set(),
      laserShots: [],
      caughtBall: null,
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

    ctx.imageSmoothingEnabled = false

    const gameState = gameStateRef.current
    const config = getLevelConfig(level)
    const baseSpeed = CANVAS_WIDTH * 0.006 * config.ballSpeed
    const BRICK_WIDTH = (CANVAS_WIDTH - (BRICK_COLUMNS + 1) * BRICK_PADDING) / BRICK_COLUMNS

    const currentPaddleWidth = gameState.activePowerups.has("long") ? PADDLE_WIDTH * 1.5 : PADDLE_WIDTH

    const handleKeyDown = (e: KeyboardEvent) => {
      gameState.keys[e.key] = true
      if (e.key === "Escape") setGameView("paused")
      if (e.key === " " && gameState.activePowerups.has("catch") && gameState.caughtBall) {
        // Release caught ball
        gameState.caughtBall = null
      }
      if (e.key === " " && gameState.activePowerups.has("laser")) {
        // Fire laser
        gameState.laserShots.push({ x: gameState.paddleX + currentPaddleWidth / 2, y: CANVAS_HEIGHT - 20 })
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.keys[e.key] = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const scaleX = CANVAS_WIDTH / rect.width
      gameState.paddleX = Math.max(
        0,
        Math.min(CANVAS_WIDTH - currentPaddleWidth, relativeX * scaleX - currentPaddleWidth / 2),
      )
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const relativeX = e.touches[0].clientX - rect.left
      const scaleX = CANVAS_WIDTH / rect.width
      gameState.paddleX = Math.max(
        0,
        Math.min(CANVAS_WIDTH - currentPaddleWidth, relativeX * scaleX - currentPaddleWidth / 2),
      )
    }

    const drawBall = (ball: Ball) => {
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = "#FFFFFF"
      ctx.fill()
      ctx.strokeStyle = "#CCCCCC"
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.closePath()
    }

    const drawPaddle = () => {
      ctx.fillStyle = gameState.activePowerups.has("laser")
        ? "#FF00FF"
        : gameState.activePowerups.has("catch")
          ? "#00FFFF"
          : "#00AAFF"
      ctx.fillRect(gameState.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT - 8, currentPaddleWidth, PADDLE_HEIGHT)
      ctx.strokeStyle = "#0088CC"
      ctx.lineWidth = 1
      ctx.strokeRect(gameState.paddleX, CANVAS_HEIGHT - PADDLE_HEIGHT - 8, currentPaddleWidth, PADDLE_HEIGHT)
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

            if (brick.hasCapsule) {
              ctx.fillStyle = "#FFFFFF"
              ctx.font = `${Math.floor(BRICK_HEIGHT * 0.5)}px Arial`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillText("●", brick.x + brick.width / 2, brick.y + brick.height / 2)
            }

            // Show hit count for multi-hit bricks
            if (brick.maxHits > 1 && !brick.unbreakable) {
              ctx.fillStyle = "#000000"
              ctx.font = `bold ${Math.floor(BRICK_HEIGHT * 0.6)}px Arial`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillText(brick.hits.toString(), brick.x + brick.width / 2, brick.y + brick.height / 2)
            }

            if (brick.unbreakable) {
              ctx.fillStyle = "#404040"
              ctx.font = `bold ${Math.floor(BRICK_HEIGHT * 0.7)}px Arial`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillText("S", brick.x + brick.width / 2, brick.y + brick.height / 2)
            }
          }
        }
      }
    }

    const drawCapsules = () => {
      gameState.capsules.forEach((capsule) => {
        if (capsule.active) {
          const capsuleColors: Record<CapsuleType, string> = {
            long: "#00FF00",
            slow: "#FFFF00",
            multi: "#FF00FF",
            laser: "#FF0000",
            catch: "#00FFFF",
            life: "#FF69B4",
            bomb: "#FF8800",
            flip: "#8800FF",
          }
          ctx.fillStyle = capsuleColors[capsule.type]
          ctx.fillRect(capsule.x - 8, capsule.y - 8, 16, 16)
          ctx.strokeStyle = "#FFFFFF"
          ctx.lineWidth = 2
          ctx.strokeRect(capsule.x - 8, capsule.y - 8, 16, 16)

          // Draw letter indicator
          ctx.fillStyle = "#000000"
          ctx.font = "bold 10px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(capsule.type[0].toUpperCase(), capsule.x, capsule.y)
        }
      })
    }

    const drawLasers = () => {
      ctx.fillStyle = "#FF00FF"
      gameState.laserShots.forEach((shot) => {
        ctx.fillRect(shot.x - 2, shot.y, 4, 20)
      })
    }

    const collisionDetection = () => {
      const now = Date.now()

      gameState.balls.forEach((ball) => {
        if (!ball.active) return

        for (let c = 0; c < BRICK_COLUMNS; c++) {
          for (let r = 0; r < gameState.bricks[c]?.length; r++) {
            const brick = gameState.bricks[c][r]
            if (brick.status === 1) {
              // Swept collision detection
              const ballNextX = ball.x + ball.dx
              const ballNextY = ball.y + ball.dy

              if (
                ballNextX + BALL_RADIUS > brick.x &&
                ballNextX - BALL_RADIUS < brick.x + brick.width &&
                ballNextY + BALL_RADIUS > brick.y &&
                ballNextY - BALL_RADIUS < brick.y + brick.height
              ) {
                // Determine collision side for more accurate bounce
                const fromLeft = ball.x < brick.x
                const fromRight = ball.x > brick.x + brick.width
                const fromTop = ball.y < brick.y
                const fromBottom = ball.y > brick.y + brick.height

                if (fromLeft || fromRight) {
                  ball.dx = -ball.dx
                } else {
                  ball.dy = -ball.dy
                }

                if (!brick.unbreakable) {
                  brick.hits--

                  if (brick.hits <= 0) {
                    brick.status = 0

                    if (brick.hasCapsule) {
                      gameState.capsules.push({
                        x: brick.x + brick.width / 2,
                        y: brick.y + brick.height,
                        dy: 2,
                        type: brick.hasCapsule as CapsuleType,
                        active: true,
                      })
                    }

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
                      if (gameState.bricks[cc][rr].status === 1 && !gameState.bricks[cc][rr].unbreakable) {
                        remainingBricks++
                      }
                    }
                  }

                  if (remainingBricks === 0) {
                    handleLevelComplete()
                  }
                }
                return
              }
            }
          }
        }
      })

      gameState.laserShots.forEach((shot) => {
        for (let c = 0; c < BRICK_COLUMNS; c++) {
          for (let r = 0; r < gameState.bricks[c]?.length; r++) {
            const brick = gameState.bricks[c][r]
            if (brick.status === 1 && !brick.unbreakable) {
              if (
                shot.x > brick.x &&
                shot.x < brick.x + brick.width &&
                shot.y > brick.y &&
                shot.y < brick.y + brick.height
              ) {
                brick.status = 0
                shot.y = -100 // Deactivate shot
                setScore((prev) => prev + brick.points)
              }
            }
          }
        }
      })
    }

    const updatePaddle = () => {
      const speed = 8
      if (gameState.keys["ArrowLeft"] || gameState.keys["a"]) {
        gameState.paddleX = Math.max(0, gameState.paddleX - speed)
      }
      if (gameState.keys["ArrowRight"] || gameState.keys["d"]) {
        gameState.paddleX = Math.min(CANVAS_WIDTH - currentPaddleWidth, gameState.paddleX + speed)
      }

      // Move caught ball with paddle
      if (gameState.caughtBall) {
        gameState.caughtBall.x = gameState.paddleX + currentPaddleWidth / 2
      }
    }

    const updateCapsules = () => {
      gameState.capsules.forEach((capsule) => {
        if (capsule.active) {
          capsule.y += capsule.dy

          // Check if paddle catches capsule
          if (
            capsule.y >= CANVAS_HEIGHT - PADDLE_HEIGHT - 16 &&
            capsule.y <= CANVAS_HEIGHT - 8 &&
            capsule.x >= gameState.paddleX &&
            capsule.x <= gameState.paddleX + currentPaddleWidth
          ) {
            capsule.active = false
            activateCapsule(capsule.type)
          }

          // Remove if off-screen
          if (capsule.y > CANVAS_HEIGHT) {
            capsule.active = false
          }
        }
      })
      gameState.capsules = gameState.capsules.filter((c) => c.active)
    }

    const activateCapsule = (type: CapsuleType) => {
      gameState.activePowerups.add(type)

      switch (type) {
        case "long":
          // Extend paddle - already handled by currentPaddleWidth
          setTimeout(() => gameState.activePowerups.delete("long"), 15000)
          break
        case "slow":
          // Slow down all balls
          gameState.balls.forEach((ball) => {
            ball.dx *= 0.6
            ball.dy *= 0.6
          })
          setTimeout(() => {
            gameState.balls.forEach((ball) => {
              ball.dx /= 0.6
              ball.dy /= 0.6
            })
            gameState.activePowerups.delete("slow")
          }, 10000)
          break
        case "multi":
          // Add two more balls
          const mainBall = gameState.balls[0]
          if (mainBall) {
            gameState.balls.push(
              { x: mainBall.x, y: mainBall.y, dx: mainBall.dx * 1.2, dy: -Math.abs(mainBall.dy), active: true },
              { x: mainBall.x, y: mainBall.y, dx: mainBall.dx * -1.2, dy: -Math.abs(mainBall.dy), active: true },
            )
          }
          break
        case "laser":
          setTimeout(() => gameState.activePowerups.delete("laser"), 15000)
          break
        case "catch":
          setTimeout(() => gameState.activePowerups.delete("catch"), 20000)
          break
        case "life":
          setLives((prev) => Math.min(prev + 1, 5))
          break
        case "bomb":
          // Destroy multiple random bricks
          let destroyed = 0
          for (let c = 0; c < BRICK_COLUMNS && destroyed < 5; c++) {
            for (let r = 0; r < gameState.bricks[c]?.length && destroyed < 5; r++) {
              if (gameState.bricks[c][r].status === 1 && !gameState.bricks[c][r].unbreakable && Math.random() < 0.3) {
                gameState.bricks[c][r].status = 0
                setScore((prev) => prev + gameState.bricks[c][r].points)
                destroyed++
              }
            }
          }
          break
        case "flip":
          // Flip paddle controls temporarily
          // This would need more complex implementation
          break
      }
    }

    const updateLasers = () => {
      gameState.laserShots.forEach((shot) => {
        shot.y -= 8
      })
      gameState.laserShots = gameState.laserShots.filter((shot) => shot.y > -50)
    }

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      drawBricks()
      gameState.balls.forEach((ball) => ball.active && drawBall(ball))
      drawPaddle()
      drawCapsules()
      drawLasers()
      collisionDetection()
      updatePaddle()
      updateCapsules()
      updateLasers()

      if (level >= 10) {
        gameState.paddleHits++
        if (gameState.paddleHits % 50 === 0) {
          const speedMultiplier = gameState.speedCycle % 2 === 0 ? 1.5 : 0.7
          gameState.balls.forEach((ball) => {
            ball.dx *= speedMultiplier
            ball.dy *= speedMultiplier
          })
          gameState.speedCycle++
        }
      }

      // Ball physics for each ball
      gameState.balls.forEach((ball, index) => {
        if (!ball.active) return

        // Wall collisions
        if (ball.x + ball.dx > CANVAS_WIDTH - BALL_RADIUS || ball.x + ball.dx < BALL_RADIUS) {
          ball.dx = -ball.dx
        }
        if (ball.y + ball.dy < BALL_RADIUS) {
          ball.dy = -ball.dy
        } else if (ball.y + ball.dy > CANVAS_HEIGHT - BALL_RADIUS - 8) {
          // Paddle collision
          if (ball.x > gameState.paddleX && ball.x < gameState.paddleX + currentPaddleWidth) {
            const hitPoint = (ball.x - gameState.paddleX) / currentPaddleWidth
            const angle = (hitPoint - 0.5) * Math.PI * 0.6 // Increased angle range for steeper bounces
            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy)
            ball.dx = speed * Math.sin(angle)
            ball.dy = -speed * Math.cos(angle)

            if (gameState.activePowerups.has("catch") && !gameState.caughtBall) {
              gameState.caughtBall = ball
              ball.dy = 0
              ball.dx = 0
            }

            setCombo(0) // Reset combo on paddle hit
            gameState.paddleHits++
          } else {
            // Ball lost
            ball.active = false
            const remainingBalls = gameState.balls.filter((b) => b.active).length

            if (remainingBalls === 0) {
              setLives((prev) => {
                const newLives = prev - 1
                if (newLives <= 0) {
                  handleGameOver()
                  return 0
                }
                // Reset ball
                gameState.balls = [
                  {
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT - 60,
                    dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
                    dy: -baseSpeed,
                    active: true,
                  },
                ]
                gameState.paddleX = (CANVAS_WIDTH - currentPaddleWidth) / 2
                setCombo(0)
                return newLives
              })
            }
          }
        }

        if (ball.active && !gameState.caughtBall) {
          ball.x += ball.dx
          ball.y += ball.dy
        }
      })

      // UI Display
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
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="relative w-full max-w-md">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="mx-auto block touch-none rounded-lg border-4 border-gray-700 shadow-2xl"
          style={{
            width: "100%",
            maxWidth: `${CANVAS_WIDTH}px`,
            height: "auto",
            aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
            imageRendering: "pixelated",
          }}
        />
      </div>

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
  )
}
