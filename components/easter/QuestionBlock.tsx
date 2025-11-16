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
    background: 'linear-gradient(45deg, #ffd700 25%, #ffa500 25%, #ffa500 50%, #ffd700 50%, #ffd700 75%, #ffa500 75%)',
    backgroundSize: '8px 8px',
    border: '3px solid #b8860b',
    borderRadius: '4px',
    position: 'relative' as const,
    boxShadow: isHovered 
      ? 'inset 2px 2px 4px rgba(255, 255, 255, 0.4), inset -2px -2px 4px rgba(0, 0, 0, 0.4), 0 6px 12px rgba(0, 0, 0, 0.3)'
      : 'inset 2px 2px 4px rgba(255, 255, 255, 0.3), inset -2px -2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
    cursor: 'pointer',
  }

  const innerStyle = {
    position: 'absolute' as const,
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: 'white',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
    fontFamily: '"Arial Black", Arial, sans-serif',
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
      <div style={innerStyle}>?</div>
    </div>
  )
}
