"use client"

import { useEffect, useState } from "react"
import { loadGameProgress, type GameProgress } from "@/lib/game-utils"

interface LevelConfig {
  level: number
  name: string
  requiredScore: number
  [key: string]: unknown
}

interface LevelSelectorProps {
  gameName: string
  levels: LevelConfig[]
  onSelectLevel: (level: number) => void
  onClose: () => void
}

export default function LevelSelector({ gameName, levels, onSelectLevel, onClose }: LevelSelectorProps) {
  const [progress, setProgress] = useState<GameProgress | null>(null)

  useEffect(() => {
    setProgress(loadGameProgress(gameName))
  }, [gameName])

  if (!progress) return null

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full mx-auto text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl sm:text-2xl font-bold capitalize">Select Level</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none p-2">
          ×
        </button>
      </div>

      {/* Stats Summary */}
      <div className="bg-gray-700/50 rounded-lg p-3 mb-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-400">Total Score</div>
          <div className="text-lg font-bold text-yellow-400">{progress.totalScore.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Games</div>
          <div className="text-lg font-bold text-blue-400">{progress.gamesPlayed}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Best Level</div>
          <div className="text-lg font-bold text-green-400">{Math.max(...progress.unlockedLevels)}</div>
        </div>
      </div>

      {/* Level Grid */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {levels.map((levelConfig) => {
          const isUnlocked = progress.unlockedLevels.includes(levelConfig.level)
          const highScore = progress.highScores[levelConfig.level] || 0
          const isCompleted = highScore >= levelConfig.requiredScore && levelConfig.level < levels.length

          return (
            <button
              key={levelConfig.level}
              onClick={() => isUnlocked && onSelectLevel(levelConfig.level)}
              disabled={!isUnlocked}
              className={`
                relative aspect-square rounded-lg flex flex-col items-center justify-center
                transition-all duration-200 border-2
                ${
                  isUnlocked
                    ? isCompleted
                      ? "bg-green-600 border-green-400 hover:bg-green-500 cursor-pointer"
                      : "bg-blue-600 border-blue-400 hover:bg-blue-500 cursor-pointer"
                    : "bg-gray-700 border-gray-600 cursor-not-allowed opacity-60"
                }
              `}
            >
              {!isUnlocked && <span className="text-2xl">🔒</span>}
              {isUnlocked && (
                <>
                  <span className="text-lg sm:text-xl font-bold">{levelConfig.level}</span>
                  {isCompleted && <span className="text-xs">⭐</span>}
                </>
              )}
              {/* High score indicator */}
              {isUnlocked && highScore > 0 && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] bg-black/50 px-1 rounded">
                  {highScore}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Level Details */}
      <div className="mt-4 text-center text-xs text-gray-400">
        <p>Complete levels to unlock more!</p>
        <p className="mt-1">🔒 = Locked | ⭐ = Completed</p>
      </div>
    </div>
  )
}
