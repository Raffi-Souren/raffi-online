"use client"

import { useState, useEffect } from "react"
import { getSoundEnabled, setSoundEnabled } from "@/lib/game-utils"

interface GameControlsProps {
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
  score: number
  level: number
  lives?: number
  timeElapsed?: number
  showLevelSelect?: () => void
}

export default function GameControls({
  isPaused,
  onPause,
  onResume,
  onRestart,
  onQuit,
  score,
  level,
  lives,
  timeElapsed,
  showLevelSelect,
}: GameControlsProps) {
  const [soundEnabled, setSoundEnabledState] = useState(true)

  useEffect(() => {
    setSoundEnabledState(getSoundEnabled())
  }, [])

  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabledState(newValue)
    setSoundEnabled(newValue)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="w-full bg-gray-800 rounded-lg p-2 sm:p-3">
      {/* Stats Row */}
      <div className="flex justify-between items-center mb-2 text-white text-xs sm:text-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="font-bold">
            Score: <span className="text-yellow-400">{score.toLocaleString()}</span>
          </span>
          <span className="font-bold">
            Level: <span className="text-blue-400">{level}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {typeof lives === "number" && (
            <span className="font-bold text-red-400">{"❤️".repeat(Math.max(0, lives))}</span>
          )}
          {typeof timeElapsed === "number" && (
            <span className="font-mono text-gray-400">{formatTime(timeElapsed)}</span>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-2">
        {isPaused ? (
          <button
            onClick={onResume}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-500 text-white rounded font-bold hover:bg-green-600 transition-colors text-xs sm:text-sm min-h-[36px]"
          >
            ▶ Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-500 text-white rounded font-bold hover:bg-yellow-600 transition-colors text-xs sm:text-sm min-h-[36px]"
          >
            ⏸ Pause
          </button>
        )}

        <button
          onClick={onRestart}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 transition-colors text-xs sm:text-sm min-h-[36px]"
        >
          🔄 Restart
        </button>

        {showLevelSelect && (
          <button
            onClick={showLevelSelect}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-500 text-white rounded font-bold hover:bg-purple-600 transition-colors text-xs sm:text-sm min-h-[36px]"
          >
            📋 Levels
          </button>
        )}

        <button
          onClick={toggleSound}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded font-bold transition-colors text-xs sm:text-sm min-h-[36px] ${
            soundEnabled ? "bg-gray-600 text-white hover:bg-gray-500" : "bg-gray-700 text-gray-400 hover:bg-gray-600"
          }`}
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>

        <button
          onClick={onQuit}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-500 text-white rounded font-bold hover:bg-red-600 transition-colors text-xs sm:text-sm min-h-[36px]"
        >
          ✕ Quit
        </button>
      </div>
    </div>
  )
}
