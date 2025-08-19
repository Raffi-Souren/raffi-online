"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"
import SnakeGame from "./SnakeGame"
import ParachuteGame from "./ParachuteGame"
import Brickbreaker from "./Brickbreaker"
import MinesweeperGame from "./MinesweeperGame"

interface Game {
  id: string
  name: string
  device: string
  description: string
  icon: string
  available: boolean
}

interface GameSelectorProps {
  isOpen: boolean
  onClose: () => void
}

const RETRO_GAMES: Game[] = [
  {
    id: "snake",
    name: "Snake",
    device: "Motorola Razr",
    description: "Classic snake game with modern controls",
    icon: "🐍",
    available: true,
  },
  {
    id: "parachute",
    name: "Parachute",
    device: "iPod Classic",
    description: "Catch falling paratroopers in this arcade classic",
    icon: "🪂",
    available: true,
  },
  {
    id: "brickbreaker",
    name: "Brick Breaker",
    device: "BlackBerry",
    description: "Break bricks with your paddle and ball",
    icon: "🧱",
    available: true,
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    device: "Desktop PC",
    description: "Find all mines without triggering them",
    icon: "💣",
    available: true,
  },
  {
    id: "tetris",
    name: "Tetris",
    device: "Game Boy",
    description: "Arrange falling blocks to clear lines",
    icon: "🟦",
    available: false,
  },
  {
    id: "pong",
    name: "Pong",
    device: "Atari",
    description: "The original arcade tennis game",
    icon: "🏓",
    available: false,
  },
]

export default function GameSelector({ isOpen, onClose }: GameSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDevice, setSelectedDevice] = useState("All")
  const [activeGame, setActiveGame] = useState<string | null>(null)

  if (!isOpen) return null

  // If a game is active, show the game component
  if (activeGame) {
    const GameComponent = {
      snake: SnakeGame,
      parachute: ParachuteGame,
      brickbreaker: Brickbreaker,
      minesweeper: MinesweeperGame,
    }[activeGame]

    if (GameComponent) {
      return (
        <WindowShell
          title={`${RETRO_GAMES.find((g) => g.id === activeGame)?.name.toUpperCase()} - ${RETRO_GAMES.find((g) => g.id === activeGame)?.device}`}
          onClose={() => setActiveGame(null)}
        >
          <GameComponent />
        </WindowShell>
      )
    }
  }

  const devices = ["All", ...Array.from(new Set(RETRO_GAMES.map((game) => game.device)))]

  const filteredGames = RETRO_GAMES.filter((game) => {
    const matchesSearch =
      game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDevice = selectedDevice === "All" || game.device === selectedDevice
    return matchesSearch && matchesDevice
  })

  const availableGames = filteredGames.filter((game) => game.available)
  const comingSoonGames = filteredGames.filter((game) => !game.available)

  const handleGameClick = (gameId: string) => {
    setActiveGame(gameId)
  }

  return (
    <WindowShell title="RETRO GAMES" onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Retro Games Collection</h2>
          <p className="text-gray-600 text-sm">Classic games from vintage devices and platforms</p>
        </div>

        {/* Search and Filter */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search games or devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2 flex-wrap">
              {devices.map((device) => (
                <button
                  key={device}
                  onClick={() => setSelectedDevice(device)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                    selectedDevice === device
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {device}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Available Games */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-green-400 pb-1 inline-block">
            AVAILABLE GAMES
          </h2>

          <div className="grid gap-3">
            {availableGames.map((game) => (
              <div
                key={game.id}
                onClick={() => handleGameClick(game.id)}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{game.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{game.name}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{game.device}</span>
                    </div>
                    <p className="text-sm text-gray-600">{game.description}</p>
                  </div>
                  <div className="text-green-500 text-sm font-semibold">PLAY</div>
                </div>
              </div>
            ))}
          </div>

          {availableGames.length === 0 && (
            <div className="text-center text-gray-500 py-4">No available games found matching your criteria</div>
          )}
        </div>

        {/* Coming Soon */}
        {comingSoonGames.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b-2 border-orange-400 pb-1 inline-block">
              COMING SOON
            </h2>

            <div className="grid gap-3">
              {comingSoonGames.map((game) => (
                <div key={game.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-75">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl grayscale">{game.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-700">{game.name}</h3>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">{game.device}</span>
                      </div>
                      <p className="text-sm text-gray-500">{game.description}</p>
                    </div>
                    <div className="text-orange-500 text-sm font-semibold">SOON</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t">
          {availableGames.length} available games • {comingSoonGames.length} coming soon
        </div>
      </div>
    </WindowShell>
  )
}
