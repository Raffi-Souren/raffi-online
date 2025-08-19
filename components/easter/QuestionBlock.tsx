"use client"

import { useState } from "react"

interface QuestionBlockProps {
  onClick: () => void
}

export default function QuestionBlock({ onClick }: QuestionBlockProps) {
  const [isClicked, setIsClicked] = useState(false)

  const handleClick = () => {
    setIsClicked(true)
    onClick()
    setTimeout(() => setIsClicked(false), 200)
  }

  return (
    <div
      className={`mario-box ${isClicked ? "scale-95" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label="Mystery box - click to discover"
      style={{
        position: "fixed",
        bottom: "120px",
        left: "20px",
        zIndex: 10,
      }}
    >
      <div className="mario-box-inner">?</div>
    </div>
  )
}
