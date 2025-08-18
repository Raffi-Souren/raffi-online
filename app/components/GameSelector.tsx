"use client"

import { useState } from "react"
import BrickBreaker from "./games/BrickBreaker"
import SnakeGame from "./games/SnakeGame"
import ParachuteGame from "./games/ParachuteGame"
import MinesweeperGame from "./MinesweeperGame"

type GameType = "brickbreaker" | "snake" | "parachute" | "minesweeper" | null

export default function GameSelector() {
  const [selectedGame, setSelectedGame] = useState<GameType>(null)

  const games = [
    {
      id: "brickbreaker" as const,
      name: "Brick Breaker",
      description: "Classic Blackberry game",
      color: "bg-blue-600",
      emoji: "🧱",
    },
    {
      id: "snake" as const,
      name: "Snake",
      description: "Nokia classic",
      color: "bg-green-600",
      emoji: "🐍",
    },
    {
      id: "parachute" as const,
      name: "Parachute",
      description: "iPod Classic game",
      color: "bg-purple-600",
      emoji: "🪂",
    },
    {
      id: "minesweeper" as const,
      name: "Minesweeper",
      description: "Windows classic",
      color: "bg-red-600",
      emoji: "💣",
    },
  ]

  if (selectedGame) {
    return (
      <div className="w-full h-full">
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-800 rounded">
          <h2 className="text-xl font-bold text-white">{games.find((g) => g.id === selectedGame)?.name}</h2>
          <button
            onClick={() => setSelectedGame(null)}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Back to Games
          </button>
        </div>

        <div className="game-container">
          {selectedGame === "brickbreaker" && <BrickBreaker />}
          {selectedGame === "snake" && <SnakeGame />}
          {selectedGame === "parachute" && <ParachuteGame />}
          {selectedGame === "minesweeper" && <MinesweeperGame />}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full p-4">
      <h2 className="text-2xl font-bold mb-6 text-center text-white">Retro Games</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {games.map((game) => (
          <button
            key={game.id}
            className={`${game.color} p-6 rounded-lg cursor-pointer transition-transform hover:scale-105 text-white shadow-lg flex flex-col items-center justify-center min-h-[120px]`}
            onClick={() => setSelectedGame(game.id)}
          >
            <div className="text-4xl mb-2">{game.emoji}</div>
            <h3 className="text-xl font-bold mb-2">{game.name}</h3>
            <p className="text-sm opacity-90">{game.description}</p>
          </button>
        ))}
      </div>

      <div className="text-center text-gray-400 text-sm">
        <p>Click any game above to start playing!</p>
        <p className="mt-2">All games support keyboard and touch controls.</p>
      </div>
    </div>
  )
}
