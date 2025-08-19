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

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

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
    <div className="text-center p-4 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-blue-600 mb-1">{count}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  )
}
