"use client"

import { useEffect, useRef, useState } from "react"

type Player = { x: number; y: number; vx: number; vy: number }
type Ob = { x: number; y: number; w: number; h: number; vx: number }

export default function ParachuteGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number>(0)
  const runningRef = useRef(true)
  const playerRef = useRef<Player>({ x: 0, y: 0, vx: 0, vy: 0 })
  const obsRef = useRef<Ob[]>([])
  const scoreRef = useRef(0)
  const [score, setScore] = useState(0)
  const inputRef = useRef(0) // -1..1
  const boundsRef = useRef({ w: 0, h: 0 })

  const reset = () => {
    const c = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(c.clientWidth * dpr)
    const h = Math.round(Math.min(560, (c.clientWidth * 3) / 4) * dpr)
    c.width = w
    c.height = h
    boundsRef.current = { w: w / dpr, h: h / dpr }
    playerRef.current = { x: boundsRef.current.w / 2, y: 40, vx: 0, vy: 0 }
    obsRef.current = []
    scoreRef.current = 0
    setScore(0)
  }

  useEffect(() => {
    reset()
    const kd = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") inputRef.current = -1
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") inputRef.current = 1
      if (e.key === " " || e.key === "Enter") runningRef.current = !runningRef.current
      if (e.key.toLowerCase() === "r") reset()
    }
    const ku = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a" || e.key === "ArrowRight" || e.key.toLowerCase() === "d")
        inputRef.current = 0
    }
    document.addEventListener("keydown", kd)
    document.addEventListener("keyup", ku)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) runningRef.current = false
    })

    // touch
    const c = canvasRef.current!
    const tm = (e: TouchEvent) => {
      const rect = c.getBoundingClientRect()
      const cx = e.touches[0].clientX - rect.left
      inputRef.current = cx < rect.width / 2 ? -1 : 1
    }
    const te = () => (inputRef.current = 0)
    c.addEventListener("touchstart", tm, { passive: true })
    c.addEventListener("touchmove", tm, { passive: true })
    c.addEventListener("touchend", te)

    window.addEventListener("resize", reset)
    return () => {
      document.removeEventListener("keydown", kd)
      document.removeEventListener("keyup", ku)
      c.removeEventListener("touchstart", tm)
      c.removeEventListener("touchmove", tm)
      c.removeEventListener("touchend", te)
      window.removeEventListener("resize", reset)
    }
  }, [])

  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext("2d")!
    const dpr = window.devicePixelRatio || 1

    const spawn = () => {
      const { w } = boundsRef.current
      const cnt = 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < cnt; i++) {
        const width = 30 + Math.random() * 60
        const x = Math.random() * (w - width)
        const y = boundsRef.current.h + 20 + Math.random() * 40
        const vx = (Math.random() - 0.5) * 50
        obsRef.current.push({ x, y, w: width, h: 12, vx })
      }
    }

    let spawnTimer = 0
    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.03)
      lastTsRef.current = ts
      const { w, h } = boundsRef.current

      if (runningRef.current) {
        // physics
        const p = playerRef.current
        // gravity with parachute drag
        const g = 220
        const drag = 0.9
        p.vy = Math.min(160, p.vy + g * dt)
        p.vx += inputRef.current * 260 * dt
        p.vx *= drag
        p.x = Math.max(10, Math.min(w - 10, p.x + p.vx * dt))
        p.y = Math.min(h - 20, p.y + p.vy * dt)

        // scroll up world as player "falls"
        const scroll = 80 * dt
        for (const o of obsRef.current) o.y -= scroll
        if (p.y > h * 0.6) {
          p.y = h * 0.6
        }

        // spawn obstacles from bottom
        spawnTimer -= dt
        if (spawnTimer <= 0) {
          spawn()
          spawnTimer = 0.8 + Math.random() * 0.7
        }
        // prune
        obsRef.current = obsRef.current.filter((o) => o.y + o.h > -10)

        // collisions (simple AABB)
        for (const o of obsRef.current) {
          if (p.x > o.x - 12 && p.x < o.x + o.w + 12 && p.y + 10 > o.y && p.y - 18 < o.y + o.h) {
            // hit -> reset score, bounce up slightly
            p.vy = -120
            scoreRef.current = Math.max(0, scoreRef.current - 5)
          }
        }

        // scoring by time survived
        scoreRef.current += dt * 2
        setScore(Math.floor(scoreRef.current))
      }

      // draw
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)
      // bg
      const grd = ctx.createLinearGradient(0, 0, 0, h)
      grd.addColorStop(0, "#04131a")
      grd.addColorStop(1, "#0b0b0b")
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      // obstacles
      for (const o of obsRef.current) {
        ctx.fillStyle = "#00ffff"
        ctx.fillRect(o.x, o.y, o.w, o.h)
      }

      // player (parachute)
      const p = playerRef.current
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 2
      // canopy
      ctx.beginPath()
      ctx.arc(p.x, p.y - 24, 18, Math.PI, 0)
      ctx.stroke()
      // strings
      ctx.beginPath()
      ctx.moveTo(p.x - 18, p.y - 24)
      ctx.lineTo(p.x - 6, p.y - 6)
      ctx.moveTo(p.x + 18, p.y - 24)
      ctx.lineTo(p.x + 6, p.y - 6)
      ctx.stroke()
      // body
      ctx.fillStyle = "#ffeb3b"
      ctx.beginPath()
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2)
      ctx.fill()

      // UI
      ctx.fillStyle = "#9ca3af"
      ctx.font = "600 14px ui-sans-serif, system-ui"
      ctx.fillText(`Score: ${score}  —  ←/→ or tap sides. Space to pause, R to restart.`, 10, 18)

      ctx.restore()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame((t) => {
      lastTsRef.current = t
      loop(t)
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [score])

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <div>Parachute • Left/Right or touch • Space pause • R restart</div>
        <div>Score: {score}</div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "min(68vh,560px)", background: "black", display: "block" }}
      />
    </div>
  )
}
