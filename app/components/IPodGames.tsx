"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import {
  createParachute,
  queueSnakeTurn,
  releaseBrickBall,
  stepParachute,
  type GridPoint,
  type ParachuteState,
  type SnakeDirection,
} from "@/lib/handheld-engine"

export type IPodGameId = "brick" | "parachute" | "snake"

export const IPOD_GAMES: { id: IPodGameId; name: string; hint: string }[] = [
  { id: "brick", name: "Brick", hint: "Wheel steers the paddle" },
  { id: "parachute", name: "Parachute", hint: "Wheel steers the drop" },
  { id: "snake", name: "Snake", hint: "Wheel turns: clockwise is right" },
]

/** Imperative surface the click wheel drives. */
export interface IPodGameHandle {
  /** Positive = clockwise. */
  wheel: (steps: number) => void
  select: () => void
  playPause: () => void
}

type Phase = "ready" | "playing" | "paused" | "over"

const INK = "#253026"
const INK_SOFT = "#5f6f58"
const HIGHLIGHT = "#316490"
const PAPER = "#eaf0db"

const lcdFont = '"Lucida Grande", "Trebuchet MS", sans-serif'

interface Brick {
  x: number
  y: number
  w: number
  h: number
  hp: number
}

interface BrickState {
  paddleX: number
  paddleW: number
  ball: { x: number; y: number; dx: number; dy: number; heldSpeed?: number }
  bricks: Brick[]
  lives: number
  score: number
  level: number
  launched: boolean
}

interface SnakeState {
  snake: GridPoint[]
  direction: SnakeDirection
  queued: SnakeDirection[]
  food: GridPoint
  score: number
  tick: number
}

const TURN_RIGHT: Record<SnakeDirection, SnakeDirection> = { UP: "RIGHT", RIGHT: "DOWN", DOWN: "LEFT", LEFT: "UP" }
const TURN_LEFT: Record<SnakeDirection, SnakeDirection> = { UP: "LEFT", LEFT: "DOWN", DOWN: "RIGHT", RIGHT: "UP" }

function buildBricks(width: number, level: number): Brick[] {
  const columns = 8
  const rows = Math.min(3 + level, 6)
  const gap = 2
  const w = (width - gap * (columns + 1)) / columns
  const h = 7
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      bricks.push({
        x: gap + column * (w + gap),
        y: 14 + row * (h + gap),
        w,
        h,
        hp: row < Math.max(0, rows - 4) ? 2 : 1,
      })
    }
  }
  return bricks
}

function createBrick(width: number, height: number, level = 1, carry?: Pick<BrickState, "score" | "lives">): BrickState {
  const paddleW = Math.max(28, 44 - level * 3)
  return {
    paddleX: (width - paddleW) / 2,
    paddleW,
    ball: { x: width / 2, y: height - 16, dx: 0, dy: 0, heldSpeed: 1.6 + level * 0.25 },
    bricks: buildBricks(width, level),
    lives: carry?.lives ?? 3,
    score: carry?.score ?? 0,
    level,
    launched: false,
  }
}

function snakeFood(snake: GridPoint[], columns: number, rows: number): GridPoint {
  const taken = new Set(snake.map((point) => `${point.x},${point.y}`))
  const free: GridPoint[] = []
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y })
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 }
}

function createSnake(columns: number, rows: number): SnakeState {
  const y = Math.floor(rows / 2)
  // Start on the left third so the opening straight gives time to find the wheel.
  const x = Math.max(3, Math.floor(columns / 4))
  const snake = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ]
  return { snake, direction: "RIGHT", queued: [], food: snakeFood(snake, columns, rows), score: 0, tick: 0 }
}

interface IPodGameProps {
  game: IPodGameId
}

const IPodGame = forwardRef<IPodGameHandle, IPodGameProps>(function IPodGame({ game }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 220, height: 155 })
  const [phase, setPhase] = useState<Phase>("ready")
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1, best: 0 })

  const phaseRef = useRef<Phase>("ready")
  const bestRef = useRef(0)
  const brickRef = useRef<BrickState | null>(null)
  const parachuteRef = useRef<ParachuteState | null>(null)
  const parachuteTargetRef = useRef(200)
  const snakeRef = useRef<SnakeState | null>(null)

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const cell = 11
  const columns = Math.floor(size.width / cell)
  const rows = Math.floor((size.height - 12) / cell)

  const reset = () => {
    brickRef.current = null
    parachuteRef.current = null
    snakeRef.current = null
    parachuteTargetRef.current = 200
    setHud((previous) => ({ score: 0, lives: 3, level: 1, best: previous.best }))
  }

  const start = () => {
    reset()
    if (game === "brick") brickRef.current = createBrick(size.width, size.height)
    if (game === "parachute") parachuteRef.current = createParachute()
    if (game === "snake") snakeRef.current = createSnake(columns, rows)
    setPhaseBoth("playing")
  }

  useImperativeHandle(
    ref,
    () => ({
      wheel: (steps) => {
        if (phaseRef.current !== "playing" || !steps) return
        if (game === "brick" && brickRef.current) {
          const state = brickRef.current
          state.paddleX = Math.max(0, Math.min(size.width - state.paddleW, state.paddleX + steps * 9))
          if (!state.launched) state.ball.x = state.paddleX + state.paddleW / 2
        } else if (game === "parachute") {
          parachuteTargetRef.current = Math.max(14, Math.min(386, parachuteTargetRef.current + steps * 18))
        } else if (game === "snake" && snakeRef.current) {
          const state = snakeRef.current
          const turn = steps > 0 ? TURN_RIGHT : TURN_LEFT
          const heading = state.queued[state.queued.length - 1] ?? state.direction
          state.queued = queueSnakeTurn(state.direction, state.queued, turn[heading])
        }
      },
      select: () => {
        const current = phaseRef.current
        if (current === "ready" || current === "over") start()
        else if (current === "paused") setPhaseBoth("playing")
        else if (game === "brick" && brickRef.current && !brickRef.current.launched) {
          releaseBrickBall(brickRef.current.ball, 1.8, size.height - 16)
          brickRef.current.launched = true
        } else if (game !== "brick") setPhaseBoth("paused")
      },
      playPause: () => {
        const current = phaseRef.current
        if (current === "playing") setPhaseBoth("paused")
        else if (current === "paused") setPhaseBoth("playing")
        else start()
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, size.width, size.height, columns, rows],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => {
      const width = Math.floor(host.clientWidth)
      const height = Math.floor(host.clientHeight)
      if (width > 0 && height > 0) setSize({ width, height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    reset()
    setPhaseBoth("ready")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    let frame = 0
    let last = performance.now()
    let accumulator = 0
    const STEP = 16

    const finish = (score: number) => {
      bestRef.current = Math.max(bestRef.current, score)
      setHud((previous) => ({ ...previous, score, best: bestRef.current }))
      setPhaseBoth("over")
    }

    const stepBrick = (state: BrickState) => {
      const { ball } = state
      const paddleY = size.height - 10
      if (!state.launched) {
        ball.x = state.paddleX + state.paddleW / 2
        ball.y = paddleY - 4
        return
      }
      ball.x += ball.dx
      ball.y += ball.dy
      if (ball.x <= 3 || ball.x >= size.width - 3) ball.dx *= -1
      if (ball.y <= 12) ball.dy = Math.abs(ball.dy)
      if (
        ball.dy > 0 &&
        ball.y >= paddleY - 4 &&
        ball.y <= paddleY + 2 &&
        ball.x >= state.paddleX - 3 &&
        ball.x <= state.paddleX + state.paddleW + 3
      ) {
        const offset = (ball.x - (state.paddleX + state.paddleW / 2)) / (state.paddleW / 2)
        const speed = Math.hypot(ball.dx, ball.dy)
        const angle = -Math.PI / 2 + offset * (Math.PI / 3)
        ball.dx = Math.cos(angle) * speed
        ball.dy = Math.sin(angle) * speed
        ball.y = paddleY - 4
      }
      for (const brick of state.bricks) {
        if (brick.hp <= 0) continue
        if (ball.x >= brick.x - 3 && ball.x <= brick.x + brick.w + 3 && ball.y >= brick.y - 3 && ball.y <= brick.y + brick.h + 3) {
          brick.hp--
          state.score += brick.hp === 0 ? 10 : 5
          const fromSide = ball.x < brick.x || ball.x > brick.x + brick.w
          if (fromSide) ball.dx *= -1
          else ball.dy *= -1
          break
        }
      }
      if (state.bricks.every((brick) => brick.hp <= 0)) {
        const next = createBrick(size.width, size.height, state.level + 1, state)
        Object.assign(state, next)
        setHud((previous) => ({ ...previous, level: state.level, score: state.score, lives: state.lives }))
        return
      }
      if (ball.y > size.height + 4) {
        state.lives--
        if (state.lives <= 0) return finish(state.score)
        state.launched = false
        ball.dx = 0
        ball.dy = 0
        ball.heldSpeed = 1.6 + state.level * 0.25
        setHud((previous) => ({ ...previous, lives: state.lives, score: state.score }))
      }
    }

    const stepSnake = (state: SnakeState) => {
      state.tick += STEP
      const interval = Math.max(95, 230 - Math.floor(state.score / 3) * 12)
      if (state.tick < interval) return
      state.tick -= interval
      if (state.queued.length) state.direction = state.queued.shift() as SnakeDirection
      const head = { ...state.snake[0] }
      if (state.direction === "UP") head.y--
      if (state.direction === "DOWN") head.y++
      if (state.direction === "LEFT") head.x--
      if (state.direction === "RIGHT") head.x++
      const grows = head.x === state.food.x && head.y === state.food.y
      const body = grows ? state.snake : state.snake.slice(0, -1)
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= columns ||
        head.y >= rows ||
        body.some((point) => point.x === head.x && point.y === head.y)
      )
        return finish(state.score)
      state.snake = [head, ...body]
      if (grows) {
        state.score++
        state.food = snakeFood(state.snake, columns, rows)
        setHud((previous) => ({ ...previous, score: state.score }))
      }
    }

    const stepParachuteGame = (state: ParachuteState) => {
      const level = 1 + Math.floor(state.landings / 4)
      const target = parachuteTargetRef.current
      stepParachute(state, state.player.x > target + 2, state.player.x < target - 2, {
        level,
        heliSpeed: 1.2 + level * 0.3,
        missileSpeed: 2.2 + level * 0.3,
        spawnRate: Math.max(900, 2200 - level * 220),
      })
      if (state.lives <= 0) return finish(state.score)
      setHud((previous) =>
        previous.score === state.score && previous.lives === state.lives && previous.level === level
          ? previous
          : { ...previous, score: state.score, lives: state.lives, level },
      )
    }

    const draw = () => {
      context.clearRect(0, 0, size.width, size.height)
      context.fillStyle = INK
      context.font = `700 9px ${lcdFont}`
      context.textBaseline = "top"

      if (game === "brick" && brickRef.current) {
        const state = brickRef.current
        for (const brick of state.bricks) {
          if (brick.hp <= 0) continue
          context.fillStyle = brick.hp > 1 ? HIGHLIGHT : INK
          context.fillRect(brick.x, brick.y, brick.w, brick.h)
        }
        context.fillStyle = INK
        context.fillRect(state.paddleX, size.height - 10, state.paddleW, 4)
        context.beginPath()
        context.arc(state.ball.x, state.ball.y, 3, 0, Math.PI * 2)
        context.fill()
        context.fillText(`${state.score}`, 3, 2)
        context.textAlign = "right"
        context.fillText("●".repeat(Math.max(0, state.lives)), size.width - 3, 2)
        context.textAlign = "left"
      } else if (game === "parachute" && parachuteRef.current) {
        const state = parachuteRef.current
        const sx = size.width / 400
        const sy = (size.height - 14) / 460
        const oy = 12
        context.fillStyle = INK_SOFT
        context.fillRect(0, size.height - 3, size.width, 3)
        for (const helicopter of state.helicopters) {
          const x = helicopter.x * sx
          const y = oy + helicopter.y * sy
          context.fillStyle = INK
          context.fillRect(x, y + 3, 14, 5)
          context.fillRect(x + (helicopter.direction > 0 ? -6 : 14), y + 4, 6, 2)
          context.fillRect(x - 2, y, 18, 1.5)
        }
        context.fillStyle = HIGHLIGHT
        for (const missile of state.missiles) context.fillRect(missile.x * sx, oy + missile.y * sy, 2, 5)
        if (state.invulnerable === 0 || Math.floor(performance.now() / 100) % 2 === 0) {
          const px = state.player.x * sx
          const py = oy + state.player.y * sy
          context.fillStyle = INK
          context.beginPath()
          context.arc(px, py - 6, 7, Math.PI, 0)
          context.fill()
          context.fillRect(px - 6, py - 6, 1, 6)
          context.fillRect(px + 5, py - 6, 1, 6)
          context.fillRect(px - 2, py, 4, 5)
        }
        context.fillStyle = INK
        context.fillText(`${state.score}`, 3, 2)
        context.textAlign = "right"
        context.fillText("●".repeat(Math.max(0, state.lives)), size.width - 3, 2)
        context.textAlign = "left"
      } else if (game === "snake" && snakeRef.current) {
        const state = snakeRef.current
        const oy = 12
        context.fillStyle = INK_SOFT
        context.fillRect(0, oy - 1, columns * cell, 1)
        context.fillStyle = HIGHLIGHT
        context.fillRect(state.food.x * cell + 2, oy + state.food.y * cell + 2, cell - 4, cell - 4)
        context.fillStyle = INK
        state.snake.forEach((segment, index) => {
          const inset = index === 0 ? 0.5 : 1.5
          context.fillRect(segment.x * cell + inset, oy + segment.y * cell + inset, cell - inset * 2, cell - inset * 2)
        })
        context.fillText(`${state.score}`, 3, 2)
      }
    }

    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (phaseRef.current === "playing") {
        accumulator += dt
        while (accumulator >= STEP && phaseRef.current === "playing") {
          accumulator -= STEP
          if (game === "brick" && brickRef.current) stepBrick(brickRef.current)
          else if (game === "parachute" && parachuteRef.current) stepParachuteGame(parachuteRef.current)
          else if (game === "snake" && snakeRef.current) stepSnake(snakeRef.current)
        }
      }
      draw()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [game, size.width, size.height, columns, rows])

  const meta = IPOD_GAMES.find((entry) => entry.id === game)!
  const overlay =
    phase === "ready"
      ? { title: meta.name, body: `${meta.hint}. Press the center button to start.` }
      : phase === "paused"
        ? { title: "Paused", body: "Press the center button to resume." }
        : phase === "over"
          ? { title: "Game Over", body: `Score ${hud.score} · Best ${hud.best}. Press center to play again.` }
          : null

  return (
    <div
      ref={hostRef}
      data-ipod-game={game}
      data-phase={phase}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${meta.name} — score ${hud.score}${game !== "snake" ? `, ${hud.lives} lives` : ""}`}
        style={{ display: "block", width: size.width, height: size.height }}
      />
      {overlay && (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "0 22px",
            textAlign: "center",
            background: `${PAPER}d9`,
            color: INK,
            fontFamily: lcdFont,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700 }}>{overlay.title}</p>
          <p style={{ fontSize: 10, lineHeight: 1.35 }}>{overlay.body}</p>
        </div>
      )}
    </div>
  )
})

export default IPodGame
