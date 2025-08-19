"use client"

import { useState } from "react"

export function QuestionBlock() {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = () => {
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 600)
  }

  return (
    <div
      onClick={handleClick}
      className={`w-12 h-12 bg-yellow-400 border-4 border-yellow-600 rounded cursor-pointer flex items-center justify-center text-2xl font-bold transition-all duration-200 hover:scale-110 ${
        isAnimating ? "animate-bounce" : ""
      }`}
      style={{
        background: "linear-gradient(45deg, #FFD700 0%, #FFA500 100%)",
        boxShadow: "inset 2px 2px 4px rgba(255,255,255,0.3), inset -2px -2px 4px rgba(0,0,0,0.3)",
      }}
    >
      ?
    </div>
  )
}
