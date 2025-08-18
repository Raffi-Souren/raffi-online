"use client"

import { useEffect, useRef, useState } from "react"

type Cell = { x: number; y: number }
type Dir = { x: number; y: number }

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number>(0)
  const accRef = useRef(0)
  const gridW = 28
  const gridH = 20
  const cellPx = 22 // logical size; DPR scaled
  const [running, setRunning] = useState(true)
  const [score, setScore] = useState(0)
  const snakeRef = useRef<Cell[]>([])
  const dirRef = useRef<Dir>({ x: 1, y: 0 })
  const nextDirRef = useRef<Dir>({ x: 1, y: 0 })
  const appleRef = useRef<Cell>({ x: 10, y: 10 })
  const deadRef = useRef(false)

  const reset = () => {
    snakeRef.current = [
      { x: 6, y: 10 },
      { x: 5, y: 10 },
      { x: 4, y: 10 },
    ]
    dirRef.current = { x: 1, y: 0 }
    nextDirRef.current = { x: 1, y: 0 }
    appleRef.current = { x: 16, y: 10 }
    setScore(0)
    deadRef.current = false
  }

  const placeApple = () => {
    while (true) {
      const a = { x: Math.floor(Math.random() * gridW), y: Math.floor(Math.random() * gridH) }
      if (!snakeRef.current.some((s) => s.x === a.x && s.y === a.y)) {
        appleRef.current = a
        return
      }
    }
  }

  useEffect(() => {
    reset()
    const canvas = canvasRef.current!
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((k === "arrowup" || k === "w") && dirRef.current.y !== 1) nextDirRef.current = { x: 0, y: -1 }
      if ((k === "arrowdown" || k === "s") && dirRef.current.y !== -1) nextDirRef.current = { x: 0, y: 1 }
      if ((k === "arrowleft" || k === "a") && dirRef.current.x !== 1) nextDirRef.current = { x: -1, y: 0 }
      if ((k === "arrowright" || k === "d") && dirRef.current.x !== -1) nextDirRef.current = { x: 1, y: 0 }
      if (k === " ") setRunning((r) => !r)
      if (k === "r") reset()
    }
    document.addEventListener("keydown", kd)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) setRunning(false)
    })

    // touch swipe
    let sx = 0,
      sy = 0
    const ts = (e: TouchEvent) => {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
    }
    const tm = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (Math.abs(dx) + Math.abs(dy) < 24) return
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && dirRef.current.x !== -1) nextDirRef.current = { x: 1, y: 0 }
        if (dx < 0 && dirRef.current.x !== 1) nextDirRef.current = { x: -1, y: 0 }
      } else {
        if (dy > 0 && dirRef.current.y !== -1) nextDirRef.current = { x: 0, y: 1 }
        if (dy < 0 && dirRef.current.y !== 1) nextDirRef.current = { x: 0, y: -1 }
      }
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
    }
    canvas.addEventListener("touchstart", ts, { passive: true })
    canvas.addEventListener("touchmove", tm, { passive: true })

    return () => {
      document.removeEventListener("keydown", kd)
      canvas.removeEventListener("touchstart", ts)
      canvas.removeEventListener("touchmove", tm)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!

    // sizing/DPR
    const dpr = window.devicePixelRatio || 1
    canvas.style.width = "100%"
    canvas.style.height = "min(68vh, 560px)"
    canvas.width = Math.round(gridW * cellPx * dpr)
    canvas.height = Math.round(gridH * cellPx * dpr)

    const tick = 0.11 // seconds per move
    const draw = () => {
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, gridW * cellPx, gridH * cellPx)
      ctx.fillStyle = "#0b0b0b"
      ctx.fillRect(0, 0, gridW * cellPx, gridH * cellPx)

      // grid faint
      ctx.strokeStyle = "rgba(255,255,255,0.06)"
      ctx.lineWidth = 1
      for (let x = 0; x <= gridW; x++) {
        ctx.beginPath()
        ctx.moveTo(x * cellPx + 0.5, 0)
        ctx.lineTo(x * cellPx + 0.5, gridH * cellPx)
        ctx.stroke()
      }
      for (let y = 0; y <= gridH; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * cellPx + 0.5)
        ctx.lineTo(gridW * cellPx, y * cellPx + 0.5)
        ctx.stroke()
      }

      // apple
      const a = appleRef.current
      ctx.fillStyle = "#ff3b3b"
      ctx.fillRect(a.x * cellPx + 3, a.y * cellPx + 3, cellPx - 6, cellPx - 6)

      // snake
      ctx.fillStyle = "#00ffff"
      for (let i = 0; i < snakeRef.current.length; i++) {
        const s = snakeRef.current[i]
        const pad = i === 0 ? 2 : 4
        ctx.fillRect(s.x * cellPx + pad, s.y * cellPx + pad, cellPx - pad * 2, cellPx - pad * 2)
      }

      // UI
      ctx.fillStyle = "#9ca3af"
      ctx.font = "600 14px ui-sans-serif, system-ui"
      ctx.fillText(`Score: ${score}${deadRef.current ? "  —  tap R to restart" : ""}`, 10, 18)
      ctx.restore()
    }

    const step = (ts: number) => {
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      if (running && !deadRef.current) {
        accRef.current += dt
        if (accRef.current >= tick) {
          accRef.current -= tick
          dirRef.current = nextDirRef.current
          const head = snakeRef.current[0]
          const nx = head.x + dirRef.current.x
          const ny = head.y + dirRef.current.y

          // bounds
          if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) {
            deadRef.current = true
          } else {
            const newHead = { x: nx, y: ny }
            if (snakeRef.current.some((s) => s.x === nx && s.y === ny)) {
              deadRef.current = true
            } else {
              snakeRef.current.unshift(newHead)
              if (nx === appleRef.current.x && ny === appleRef.current.y) {
                setScore((s) => s + 1)
                placeApple()
              } else {
                snakeRef.current.pop()
              }
            }
          }
        }
      }
      draw()
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame((t) => {
      lastTsRef.current = t
      step(t)
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running, score])

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
        <div>Snake • Arrows/WASD/Swipe • Space to pause • R to restart</div>
        <div>Score: {score}</div>
      </div>
      <canvas ref={canvasRef} style={{ width: "100%", height: "min(68vh,560px)", background: "black" }} />
      {!running && <div className="mt-2 text-xs text-gray-500">Paused. Press Space or tap the canvas to resume.</div>}
    </div>
  )
}
