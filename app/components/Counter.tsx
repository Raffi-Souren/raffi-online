"use client"

import { useState, useEffect } from "react"

interface CounterProps {
  end: number
  label: string
  icon: string
}

export function Counter({ end, label, icon }: CounterProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = end / steps
    const stepDuration = duration / steps

    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [end])

  return (
    <div className="text-center p-4 bg-white rounded-lg shadow-md">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-blue-600 mb-1">{count}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  )
}

export default Counter
