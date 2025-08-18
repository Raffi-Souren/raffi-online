"use client"

import { useState } from "react"
import SnakeGame from "./SnakeGame"

export default function RazorPhoneMockup() {
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  // Handle keypad controls
  const handleKeyPress = (key: string) => {
    // Map phone keys to game controls
    let gameKey = ""
    switch (key) {
      case "2":
        gameKey = "ArrowUp"
        break
      case "8":
        gameKey = "ArrowDown"
        break
      case "4":
        gameKey = "ArrowLeft"
        break
      case "6":
        gameKey = "ArrowRight"
        break
      case "5":
        gameKey = " " // Space for start/pause
        break
      case "*":
        gameKey = "Escape" // Menu/back
        break
      default:
        return
    }

    // Simulate key press for the game
    const event = new KeyboardEvent("keydown", { key: gameKey })
    window.dispatchEvent(event)

    // Visual feedback
    setPressedKey(key)
    setTimeout(() => setPressedKey(null), 150)
  }

  const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  const getKeyLabel = (key: string) => {
    switch (key) {
      case "2":
        return "2\nABC ↑"
      case "4":
        return "4\nGHI ←"
      case "5":
        return "5\nJKL ●"
      case "6":
        return "6\nMNO →"
      case "8":
        return "8\nTUV ↓"
      case "*":
        return "*\nMENU"
      default:
        return key
    }
  }

  return (
    <div className="relative w-[280px] h-[560px] bg-gradient-to-b from-pink-500 to-pink-700 rounded-[25px] shadow-xl overflow-hidden mx-auto">
      {/* Phone top section */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gray-900 rounded-t-[25px]">
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full"></div>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-gray-400 font-bold">MOTOROLA</div>
      </div>

      {/* Phone screen */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[220px] h-[280px] bg-gray-200 rounded-sm overflow-hidden border-2 border-gray-800">
        <SnakeGame />
      </div>

      {/* Instructions */}
      <div className="absolute top-[310px] left-1/2 -translate-x-1/2 text-center text-white text-xs px-4">
        <div className="bg-black bg-opacity-30 rounded px-2 py-1">Use keypad: 2↑ 4← 5● 6→ 8↓</div>
      </div>

      {/* Phone keypad */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[240px] grid grid-cols-3 gap-1">
        {keypadKeys.map((key) => (
          <button
            key={key}
            className={`h-12 rounded-lg flex flex-col items-center justify-center text-gray-800 font-bold text-sm transition-all duration-150 ${
              pressedKey === key ? "bg-gray-100 scale-95 shadow-inner" : "bg-gray-300 hover:bg-gray-200 shadow-md"
            } ${["2", "4", "5", "6", "8", "*"].includes(key) ? "ring-2 ring-yellow-400 ring-opacity-50" : ""}`}
            onTouchStart={(e) => {
              e.preventDefault()
              handleKeyPress(key)
            }}
            onClick={(e) => {
              e.preventDefault()
              handleKeyPress(key)
            }}
          >
            <div className="text-center leading-tight whitespace-pre-line text-xs">{getKeyLabel(key)}</div>
          </button>
        ))}
      </div>

      {/* Razr branding */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white font-bold opacity-70">RAZR</div>
    </div>
  )
}
