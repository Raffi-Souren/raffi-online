"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"
import SnakeGame from "./SnakeGame"
import ParachuteGame from "./ParachuteGame"
import Brickbreaker from "./Brickbreaker"
import MinesweeperGame from "./MinesweeperGame"
import DoomGame from "./DoomGame"
import GTAViceCity from "./GTAViceCity"
import AgeOfEmpires2 from "./AgeOfEmpires2"

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
    id: "gta-vice-city",
    name: "GTA: Vice City",
    device: "DOS Browser",
    description: "Open-world crime action in 1980s Miami",
    icon: "🏝️",
    available: true,
  },
  {
    id: "age-of-empires-2",
    name: "Age of Empires II",
    device: "DOS Browser",
    description: "Command medieval armies in epic RTS battles",
    icon: "🏰",
    available: true,
  },
  {
    id: "doom",
    name: "DOOM Captcha",
    device: "Vercel Edge",
    description: "Prove you're human by slaying demons",
    icon: "😈",
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
  {
    id: "solitaire",
    name: "Solitaire",
    device: "Windows 98",
    description: "The classic card game",
    icon: "🃏",
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
      doom: DoomGame,
      snake: SnakeGame,
      parachute: ParachuteGame,
      brickbreaker: Brickbreaker,
      minesweeper: MinesweeperGame,
      "gta-vice-city": GTAViceCity,
      "age-of-empires-2": AgeOfEmpires2,
    }[activeGame]

    if (GameComponent) {
      return (
        <WindowShell
          title={`${RETRO_GAMES.find((g) => g.id === activeGame)?.name.toUpperCase()} - ${RETRO_GAMES.find((g) => g.id === activeGame)?.device}`}
          onClose={() => setActiveGame(null)}
        >
          <div className="w-full h-full min-h-[300px] flex items-center justify-center">
            <GameComponent />
          </div>
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
      <div className="space-y-4 overflow-x-hidden">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2" style={{ color: "#111827" }}>
            Retro Games Collection
          </h2>
          <p className="text-gray-600 text-xs sm:text-sm" style={{ color: "#4B5563" }}>
            Classic games from vintage devices and platforms
          </p>
        </div>

        {/* Search and Filter */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search games or devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "#111827" }}
            />

            <div className="flex gap-2 flex-wrap pb-1">
              {devices.map((device) => (
                <button
                  key={device}
                  onClick={() => setSelectedDevice(device)}
                  className={`px-2 sm:px-3 py-1 text-xs rounded-md border transition-colors whitespace-nowrap flex-shrink-0 ${
                    selectedDevice === device
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  style={{ color: selectedDevice === device ? "#FFFFFF" : "#374151" }}
                >
                  {device}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Available Games */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <h2
            className="text-base sm:text-lg font-semibold text-gray-900 mb-3 border-b-2 border-green-400 pb-1 inline-block"
            style={{ color: "#111827" }}
          >
            AVAILABLE GAMES
          </h2>

          <div className="grid gap-2 sm:gap-3">
            {availableGames.map((game) => (
              <div
                key={game.id}
                onClick={() => handleGameClick(game.id)}
                className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div className="text-xl sm:text-2xl flex-shrink-0">{game.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base" style={{ color: "#111827" }}>
                      {game.name}
                    </h3>
                    <span
                      className="text-xs bg-blue-100 text-blue-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap"
                      style={{ color: "#1E40AF", backgroundColor: "#DBEAFE", borderColor: "#A7F3D0" }}
                    >
                      {game.device}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-1" style={{ color: "#4B5563" }}>
                    {game.description}
                  </p>
                </div>
                <div
                  className="text-green-600 text-xs font-bold px-2 py-1 rounded border border-green-200 bg-green-50 flex-shrink-0"
                  style={{
                    color: "#059669",
                    backgroundColor: "#ECFDF5",
                    borderColor: "#A7F3D0",
                    minWidth: "45px",
                    textAlign: "center",
                  }}
                >
                  PLAY
                </div>
              </div>
            ))}
          </div>

          {availableGames.length === 0 && (
            <div className="text-center text-gray-500 py-4 text-sm" style={{ color: "#6B7280" }}>
              No available games found matching your criteria
            </div>
          )}
        </div>

        {/* Coming Soon */}
        {comingSoonGames.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <h2
              className="text-base sm:text-lg font-semibold text-gray-900 mb-3 border-b-2 border-orange-400 pb-1 inline-block"
              style={{ color: "#111827" }}
            >
              COMING SOON
            </h2>

            <div className="grid gap-2 sm:gap-3">
              {comingSoonGames.map((game) => (
                <div
                  key={game.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 opacity-75"
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div className="text-xl sm:text-2xl grayscale flex-shrink-0">{game.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-700 text-sm sm:text-base" style={{ color: "#374151" }}>
                        {game.name}
                      </h3>
                      <span
                        className="text-xs bg-gray-200 text-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap"
                        style={{ color: "#4B5563", backgroundColor: "#E5E7EB" }}
                      >
                        {game.device}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 line-clamp-1" style={{ color: "#6B7280" }}>
                      {game.description}
                    </p>
                  </div>
                  <div
                    className="text-orange-500 text-xs font-semibold px-2 flex-shrink-0"
                    style={{ color: "#F97316", minWidth: "45px", textAlign: "center" }}
                  >
                    SOON
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t" style={{ color: "#6B7280" }}>
          {availableGames.length} available games • {comingSoonGames.length} coming soon
        </div>
      </div>
    </WindowShell>
  )
}
