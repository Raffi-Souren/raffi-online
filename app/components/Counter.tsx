'use client'

import { useState, useEffect } from 'react'

export default function Counter({ end, label, icon }: { end: number; label: string; icon: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => Math.min(c + 1, end))
    }, 50)

    return () => clearInterval(timer)
  }, [end])

  return (
    <div className="window">
      <div className="window-title">
        {icon} {label}
      </div>
      <div className="window-content text-center p-4">
        <div className="pyrex-text mb-2">{count}</div>
        <div className="canary-text">{label}</div>
      </div>
    </div>
  )
}

