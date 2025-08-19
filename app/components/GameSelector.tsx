"use client"

import { useState } from "react"
import WindowShell from "../../components/ui/WindowShell"

interface Game {
  id: string
  name: string
  platform: string
  year: string
  description: string
  icon: string
  category: string
}

const RETRO_GAMES: Game[] = [
  {
    id: "snake",
    name: "Snake",
    platform: "Nokia 3310",
    year: "1997",
    description: "Classic snake game from Nokia phones",
    icon: "🐍",
    category: "Arcade",
  },
  {
    id: "brickbreaker",
    name: "Brick Breaker",
    platform: "BlackBerry",
    year: "2004",
    description: "Addictive ball and paddle game",
    icon: "🧱",
    category: "Arcade",
  },
  {
    id: "parachute",
    name: "Parachute",
    platform: "iPod Classic",
    year: "2006",
    description: "Catch falling paratroopers",
    icon: "🪂",
    category: "Action",
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    platform: "Windows 95",
    year: "1995",
    description: "Classic mine detection puzzle",
    icon: "💣",
    category: "Puzzle",
  },
  {
    id: "solitaire",
    name: "Solitaire",
    platform: "Windows 95",
    year: "1995",
    description: "Classic card game",
    icon: "🃏",
    category: "Card",
  },
  {
    id: "tetris",
    name: "Tetris",
    platform: "Game Boy",
    year: "1989",
    description: "Falling blocks puzzle game",
    icon: "🟦",
    category: "Puzzle",
  },
]

interface GameSelectorProps {
  isOpen: boolean
  onClose: () => void
  onGameSelect?: (gameId: string) => void
}

export default function GameSelector({ isOpen, onClose, onGameSelect }: GameSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")

  const categories = ["All", ...Array.from(new Set(RETRO_GAMES.map((game) => game.category)))]

  const filteredGames = RETRO_GAMES.filter((game) => {
    const matchesSearch =
      game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const handleGameClick = (gameId: string) => {
    if (onGameSelect) {
      onGameSelect(gameId)
    }
  }

  return (
    <WindowShell id="retro-games" title="RETRO GAMES COLLECTION" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="content-section">
          <h2 className="section-title">Retro Games Collection</h2>
          <p className="text-xs text-gray-600">Classic games from vintage devices and platforms</p>
        </div>

        {/* Filters */}
        <div className="content-section">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="xp-input w-full"
            />

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`xp-button text-xs ${
                    selectedCategory === category ? "bg-blue-200 border-blue-400" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Games Grid */}
        <div className="content-section">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                onClick={() => handleGameClick(game.id)}
                className="game-card cursor-pointer p-3 bg-white rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{game.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{game.name}</div>
                    <div className="text-xs text-gray-600">
                      {game.platform} • {game.year}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{game.description}</div>
                    <div className="inline-block px-2 py-1 bg-gray-100 text-xs rounded mt-2">{game.category}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center text-gray-500 py-8 text-xs">
              <div className="text-2xl mb-2">🎮</div>
              <p>No games found matching your criteria</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="content-section">
          <div className="text-xs text-gray-600 text-center">
            {filteredGames.length} of {RETRO_GAMES.length} games shown
          </div>
        </div>
      </div>
    </WindowShell>
  )
}
