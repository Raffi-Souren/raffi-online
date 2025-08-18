"use client"

import { useEffect, useRef, useState } from "react"

type Vec = { x: number; y: number }

export default function BrickBreaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number>(0)
  const accRef = useRef(0)
  const runningRef = useRef(true)
  const [ui, setUi] = useState({ score: 0, lives: 3, level: 1 })

  // Game refs (avoid rerenders)
  const paddleRef = useRef({ x: 0, y: 0, w: 100, h: 14 })
  const ballRef = useRef({ p: { x: 0, y: 0 }, v: { x: 220, y: -260 }, r: 7 })
  const bricksRef = useRef<{ x: number; y: number; w: number; h: number; hp: number }[]>([])
  const boundsRef = useRef({ w: 0, h: 0 })
  const inputXRef = useRef<number | null>(null)

  const resetLevel = (level = ui.level) => {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    boundsRef.current = { w, h }

    // paddle
    paddleRef.current.w = Math.max(72, 120 - level * 6)
    paddleRef.current.h = 14
    paddleRef.current.x = w / 2 - paddleRef.current.w / 2
    paddleRef.current.y = h - 42

    // ball
    ballRef.current.p = { x: w / 2, y: h - 60 }
    ballRef.current.v = { x: 180 + level * 20, y: -(210 + level * 20) }
    ballRef.current.r = 7

    // bricks
    const rows = 5 + Math.min(4, Math.floor(level / 2))
    const cols = 10
    const pad = 8
    const top = 64
    const brickW = (w - pad * (cols + 1)) / cols
    const brickH = 18
    const bricks = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: pad + c * (brickW + pad),
          y: top + r * (brickH + pad),
          w: brickW,
          h: brickH,
          hp: 1 + Math.floor(level / 3),
        })
      }
    }
    bricksRef.current = bricks
  }

  const resize = () => {
    resetLevel(ui.level)
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const onMove = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      inputXRef.current = ((clientX - rect.left) / rect.width) * boundsRef.current.w
    }

    const mm = (e: MouseEvent) => onMove(e.clientX)
    const tm = (e: TouchEvent) => onMove(e.touches[0].clientX)
    const kd = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") runningRef.current = !runningRef.current
      if (e.key === "r") {
        setUi((u) => ({ ...u, lives: 3, score: 0, level: 1 }))
        resetLevel(1)
      }
    }

    window.addEventListener("resize", resize)
    canvas.addEventListener("mousemove", mm)
    canvas.addEventListener("touchstart", tm, { passive: true })
    canvas.addEventListener("touchmove", tm, { passive: true })
    document.addEventListener("keydown", kd)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) runningRef.current = false
    })

    resetLevel()

    return () => {
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("mousemove", mm)
      canvas.removeEventListener("touchstart", tm)
      canvas.removeEventListener("touchmove", tm)
      document.removeEventListener("keydown", kd)
    }
  }, [])

  // Fixed timestep loop
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const dpr = () => window.devicePixelRatio || 1
    const step = 1 / 120 // physics step
    const maxFrame = 0.25

    const draw = () => {
      const { w, h } = boundsRef.current
      ctx.save()
      ctx.scale(dpr(), dpr())
      ctx.clearRect(0, 0, w, h)

      // BG
      ctx.fillStyle = "#0b0b0b"
      ctx.fillRect(0, 0, w, h)

      // Title + UI
      ctx.fillStyle = "#00ffff"
      ctx.font = "600 14px ui-sans-serif, system-ui"
      ctx.fillText(`Score: ${ui.score}`, 12, 20)
      ctx.fillText(`Lives: ${ui.lives}`, 100, 20)
      ctx.fillText(`Lvl: ${ui.level}`, 176, 20)

      // Bricks
      for (const b of bricksRef.current) {
        if (b.hp <= 0) continue
        ctx.fillStyle = b.hp > 1 ? "#35f" : "#0ff"
        ctx.fillRect(b.x, b.y, b.w, b.h)
      }

      // Paddle
      const pad = paddleRef.current
      ctx.fillStyle = "#fff"
      ctx.fillRect(pad.x, pad.y, pad.w, pad.h)

      // Ball
      const ball = ballRef.current
      ctx.beginPath()
      ctx.arc(ball.p.x, ball.p.y, ball.r, 0, Math.PI * 2)
      ctx.fillStyle = "#ff0"
      ctx.fill()

      ctx.restore()
    }

    const advance = (dt: number) => {
      // input
      const targetX = inputXRef.current
      if (targetX != null) {
        const pad = paddleRef.current
        const lerp = 0.25
        pad.x = Math.max(0, Math.min(boundsRef.current.w - pad.w, pad.x + (targetX - (pad.x + pad.w / 2)) * lerp))
      }

      // physics
      const pad = paddleRef.current
      const ball = ballRef.current
      const { w, h } = boundsRef.current

      ball.p.x += ball.v.x * dt
      ball.p.y += ball.v.y * dt

      // walls
      if (ball.p.x < ball.r) {
        ball.p.x = ball.r
        ball.v.x *= -1
      }
      if (ball.p.x > w - ball.r) {
        ball.p.x = w - ball.r
        ball.v.x *= -1
      }
      if (ball.p.y < ball.r) {
        ball.p.y = ball.r
        ball.v.y *= -1
      }

      // paddle collision (simple AABB circle)
      if (
        ball.p.y + ball.r >= pad.y &&
        ball.p.y - ball.r <= pad.y + pad.h &&
        ball.p.x >= pad.x &&
        ball.p.x <= pad.x + pad.w &&
        ball.v.y > 0
      ) {
        ball.p.y = pad.y - ball.r
        // reflect with angle based on hit position
        const hit = (ball.p.x - (pad.x + pad.w / 2)) / (pad.w / 2)
        const speed = Math.hypot(ball.v.x, ball.v.y) * 1.02
        const angle = (-Math.PI / 3) * hit - Math.PI / 2.2
        ball.v.x = speed * Math.cos(angle)
        ball.v.y = Math.abs(speed * Math.sin(angle))
        ball.v.y *= -1
      }

      // bricks collision (swept resolution-lite)
      for (const b of bricksRef.current) {
        if (b.hp <= 0) continue
        if (
          ball.p.x + ball.r > b.x &&
          ball.p.x - ball.r < b.x + b.w &&
          ball.p.y + ball.r > b.y &&
          ball.p.y - ball.r < b.y + b.h
        ) {
          // pick axis by penetration
          const px = Math.min(ball.p.x + ball.r - b.x, b.x + b.w - (ball.p.x - ball.r))
          const py = Math.min(ball.p.y + ball.r - b.y, b.y + b.h - (ball.p.y - ball.r))
          if (px < py) {
            ball.v.x *= -1
            ball.p.x += Math.sign(ball.v.x) * 1
          } else {
            ball.v.y *= -1
            ball.p.y += Math.sign(ball.v.y) * 1
          }
          b.hp -= 1
          setUi((u) => ({ ...u, score: u.score + 10 }))
        }
      }

      // lose life
      if (ball.p.y - ball.r > h) {
        setUi((u) => {
          const lives = u.lives - 1
          if (lives <= 0) {
            // reset
            resetLevel(1)
            return { score: 0, lives: 3, level: 1 }
          } else {
            resetLevel(u.level)
            return { ...u, lives }
          }
        })
      }

      // next level?
      if (bricksRef.current.every((b) => b.hp <= 0)) {
        setUi((u) => {
          const level = u.level + 1
          resetLevel(level)
          return { ...u, level }
        })
      }
    }

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTsRef.current) / 1000, maxFrame)
      lastTsRef.current = ts
      if (runningRef.current) {
        accRef.current += dt
        while (accRef.current >= step) {
          advance(step)
          accRef.current -= step
        }
        draw()
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame((t) => {
      lastTsRef.current = t
      loop(t)
    })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ui.level])

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <div>Brick Breaker • Mouse/Touch • Space to pause • R to reset</div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "min(68vh,560px)", background: "black", display: "block" }}
      />
    </div>
  )
}
