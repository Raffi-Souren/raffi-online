"use client"

import { useState } from "react"

interface QuestionBlockProps {
  onClick?: () => void
}

export default function QuestionBlock({ onClick }: QuestionBlockProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleClick = () => {
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 600)
    if (onClick) {
      onClick()
    }
  }

  const boxStyle = {
    width: '48px',
    height: '48px',
    position: 'relative' as const,
    borderRadius: '4px',
    boxShadow: isHovered
      ? '0 6px 12px rgba(0, 0, 0, 0.35)'
      : '0 4px 8px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
    cursor: 'pointer',
  }

  const imgStyle = {
    display: 'block' as const,
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={boxStyle}
      className={isAnimating ? "animate-bounce" : ""}
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/question-block.png" alt="" draggable={false} style={imgStyle} />
    </div>
  )
}
