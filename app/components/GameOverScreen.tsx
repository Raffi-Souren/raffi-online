"use client"

import { useState, useEffect } from "react"
import { getPlayerName, setPlayerName } from "@/lib/game-utils"

interface GameOverScreenProps {
  score: number
  level: number
  isHighScore: boolean
  gameName: string
  completed?: boolean
  onRestart: () => void
  onQuit: () => void
  onViewLeaderboard: () => void
  stats?: {
    timeElapsed?: number
    accuracy?: number
    maxCombo?: number
  }
}

export default function GameOverScreen({
  score,
  level,
  isHighScore,
  gameName,
  completed = false,
  onRestart,
  onQuit,
  onViewLeaderboard,
  stats,
}: GameOverScreenProps) {
  const [playerNameInput, setPlayerNameInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const storedName = getPlayerName()
    if (storedName) {
      setPlayerNameInput(storedName)
    }
  }, [])

  const handleSaveScore = async () => {
    if (!playerNameInput.trim() || isSaving) return

    setIsSaving(true)
    setSaveError(null)
    setPlayerName(playerNameInput.trim())

    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: playerNameInput.trim(),
          gameName,
          score,
          level,
        }),
      })
      if (!response.ok) throw new Error("The leaderboard could not save this score. Try again later.")
      setSaved(true)
    } catch {
      setSaveError("The leaderboard could not save this score. Try again later; you can keep playing.")
    } finally {
      setIsSaving(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="bg-black/90 rounded-lg p-4 sm:p-6 max-w-sm w-full mx-auto text-center text-white">
      <h2 className={`text-2xl sm:text-3xl font-bold mb-2 ${completed ? "text-green-400" : "text-red-500"}`}>
        {completed ? "BOARD COMPLETE" : "GAME OVER"}
      </h2>

      {isHighScore && <div className="text-yellow-400 text-lg font-bold mb-2 animate-pulse">🎉 NEW HIGH SCORE! 🎉</div>}

      <div className="bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
        <div className="flex justify-between text-lg">
          <span className="text-gray-400">Final Score:</span>
          <span className="font-bold text-yellow-400">{score.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Level Reached:</span>
          <span className="font-bold text-blue-400">{level}</span>
        </div>

        {stats?.timeElapsed && (
          <div className="flex justify-between">
            <span className="text-gray-400">Time Played:</span>
            <span className="font-mono">{formatTime(stats.timeElapsed)}</span>
          </div>
        )}

        {typeof stats?.accuracy === "number" && (
          <div className="flex justify-between">
            <span className="text-gray-400">Accuracy:</span>
            <span className="font-bold text-green-400">{stats.accuracy}%</span>
          </div>
        )}

        {typeof stats?.maxCombo === "number" && stats.maxCombo > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">Max Combo:</span>
            <span className="font-bold text-purple-400">{stats.maxCombo}x</span>
          </div>
        )}
      </div>

      {/* Save Score Section */}
      {!saved && (
        <div className="mb-4">
          <input
            aria-label="Player name for leaderboard"
            type="text"
            value={playerNameInput}
            onChange={(e) => setPlayerNameInput(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded mb-2 text-white text-center"
            onKeyDown={(e) => e.key === "Enter" && handleSaveScore()}
          />
          <button
            onClick={handleSaveScore}
            disabled={!playerNameInput.trim() || isSaving}
            className="w-full px-4 py-2 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Score"}
          </button>
        </div>
      )}

      {saved && <div className="mb-4 p-2 bg-green-600 rounded text-sm">Score saved to leaderboard!</div>}
      {saveError && (
        <p role="alert" className="mb-4 text-sm text-amber-200">
          {saveError}
        </p>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          onClick={onRestart}
          className="w-full px-4 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-400 transition-colors"
        >
          🔄 Play Again
        </button>

        <button
          onClick={onViewLeaderboard}
          className="w-full px-4 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-400 transition-colors"
        >
          🏆 View Leaderboard
        </button>

        <button
          onClick={onQuit}
          className="w-full px-4 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-500 transition-colors"
        >
          ✕ Back to Menu
        </button>
      </div>
    </div>
  )
}
