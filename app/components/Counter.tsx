"use client"

import { useState, useEffect } from "react"

interface CounterProps {
  end: number
  label: string
  icon: string
  duration?: number
}

export default function Counter({ end, label, icon, duration = 2000 }: CounterProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      setCount(Math.floor(progress * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [end, duration])

  return (
    <div className="counter-card">
      <div className="counter-icon">{icon}</div>
      <div className="counter-number">{count}</div>
      <div className="counter-label">{label}</div>
    </div>
  )
}
