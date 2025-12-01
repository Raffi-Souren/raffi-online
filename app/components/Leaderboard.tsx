"use client"

import { useEffect, useState } from "react"

interface Score {
  player_name: string
  score: number
  level: number
  created_at: string
}

interface LeaderboardProps {
  gameName: string
  currentScore?: number
  onClose?: () => void
}

export default function Leaderboard({ gameName, currentScore, onClose }: LeaderboardProps) {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchScores()
  }, [gameName])

  const fetchScores = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scores?game=${gameName}&limit=10`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setScores(data.scores || [])
    } catch (err) {
      console.error("Failed to fetch scores:", err)
      setError("Could not load leaderboard")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0:
        return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black"
      case 1:
        return "bg-gradient-to-r from-gray-300 to-gray-400 text-black"
      case 2:
        return "bg-gradient-to-r from-orange-400 to-orange-500 text-black"
      default:
        return "bg-gray-700 text-white"
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return "🥇"
      case 1:
        return "🥈"
      case 2:
        return "🥉"
      default:
        return `${index + 1}`
    }
  }

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full mx-auto text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl sm:text-2xl font-bold capitalize flex items-center gap-2">🏆 {gameName} Leaderboard</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none p-2">
            ×
          </button>
        )}
      </div>

      {/* Current score indicator */}
      {typeof currentScore === "number" && currentScore > 0 && (
        <div className="mb-4 p-3 bg-blue-600/30 border border-blue-500 rounded-lg text-center">
          <p className="text-sm text-blue-300">Your Score</p>
          <p className="text-2xl font-bold text-blue-400">{currentScore.toLocaleString()}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={fetchScores} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-400 transition-colors">
            Retry
          </button>
        </div>
      ) : scores.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-4xl mb-2">🎮</p>
          <p>No scores yet.</p>
          <p className="text-sm">Be the first to play!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scores.map((score, index) => (
            <div
              key={`${score.player_name}-${score.created_at}`}
              className={`flex items-center justify-between p-3 rounded-lg ${getRankStyle(index)}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="font-bold text-lg w-8 flex-shrink-0 text-center">{getRankIcon(index)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{score.player_name}</p>
                  <p className="text-xs opacity-70">Level {score.level}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-bold text-lg">{score.score.toLocaleString()}</span>
                <span className="text-xs opacity-70 hidden sm:block">{formatDate(score.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh button */}
      <div className="mt-4 text-center">
        <button onClick={fetchScores} className="text-sm text-gray-400 hover:text-white transition-colors">
          🔄 Refresh
        </button>
      </div>
    </div>
  )
}
