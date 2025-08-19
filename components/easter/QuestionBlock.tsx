"use client"

import { useState } from "react"

interface QuestionBlockProps {
  onClick?: () => void
}

export default function QuestionBlock({ onClick }: QuestionBlockProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = () => {
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 600)
    if (onClick) {
      onClick()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`mario-box cursor-pointer transition-transform ${isAnimating ? "animate-bounce" : "hover:scale-110"}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label="Mystery box - click to discover"
    >
      <div className="mario-box-inner">?</div>
    </div>
  )
}
