"use client"

import { useState, useEffect } from "react"

export default function Counter({ end, label, icon }: { end: number; label: string; icon: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => Math.min(c + 1, end))
    }, 50)

    return () => clearInterval(timer)
  }, [end])

  return (
    <div className="bg-gradient-to-b from-blue-600 to-blue-800 border-2 border-white rounded-lg p-4 text-center shadow-lg">
      <div className="text-white mb-2 text-lg">{icon}</div>
      <div className="text-3xl font-bold text-yellow-400 mb-1">{count}</div>
      <div className="text-white text-sm font-semibold uppercase tracking-wide">{label}</div>
    </div>
  )
}
