"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import WindowShell from "../../components/ui/WindowShell"
import SnakeGame from "./SnakeGame"
import ParachuteGame from "./ParachuteGame"
import Brickbreaker from "./Brickbreaker"
import MinesweeperGame from "./MinesweeperGame"
import DoomGame from "./DoomGame"
import AgeOfEmpires2 from "./AgeOfEmpires2"
import XMenArcade from "./XMenArcade"

const SnakeGame = dynamic(() => import("./SnakeGame"))
const ParachuteGame = dynamic(() => import("./ParachuteGame"))
const Brickbreaker = dynamic(() => import("./Brickbreaker"))
const MinesweeperGame = dynamic(() => import("./MinesweeperGame"))
const DoomGame = dynamic(() => import("./DoomGame"))
const AgeOfEmpires2 = dynamic(() => import("./AgeOfEmpires2"))
const XMenArcade = dynamic(() => import("./XMenArcade"))

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
    id: "xmen-arcade",
    name: "X-Men: The Arcade Game",
    device: "Arcade",
    description: "Classic 1992 Konami beat 'em up arcade game",
    icon: "🦸",
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
]

/**
 * Games that embed a third-party full-frame viewport (an iframe that has no
 * intrinsic height) and therefore need the window to hand them a definite one.
 *
 * Everything else is an intrinsic React/canvas game that sizes to its own
 * content. Forcing the `fill` contract onto those centred them inside a
 * fixed-height flex box, so anything taller than the window overflowed equally
 * above and below — and the overflow above a centred flex item is unreachable
 * by scrolling. Intrinsic games stay top-aligned in a normally scrolling
 * window instead.
 */
const EMBEDDED_VIEWPORT_GAMES = new Set(["doom", "xmen-arcade"])

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
      "age-of-empires-2": AgeOfEmpires2,
      "xmen-arcade": XMenArcade,
    }[activeGame]

    if (GameComponent) {
      const embedded = EMBEDDED_VIEWPORT_GAMES.has(activeGame)
      return (
        <WindowShell
          key={`game-${activeGame}`}
          title={`${RETRO_GAMES.find((g) => g.id === activeGame)?.name.toUpperCase()} - ${RETRO_GAMES.find((g) => g.id === activeGame)?.device}`}
          onClose={() => setActiveGame(null)}
          fill={embedded}
        >
          {embedded ? (
            // The embedded game owns the frame and manages its own floor.
            <GameComponent />
          ) : (
            // items-start, never items-center: content taller than the window
            // must scroll from the top with every control reachable.
            //
            // `relative` anchors each game's own `absolute inset-0` start/pause
            // overlays to this box rather than to the window frame, and the
            // 360px floor is tall enough that those overlays' vertically
            // centred contents fit instead of spilling above the scroll origin.
            <div className="relative flex w-full min-h-[360px] items-start justify-center">
              <GameComponent />
            </div>
          )}
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

  const handleGameClick = (gameId: string) => {
    setActiveGame(gameId)
  }

  return (
    <WindowShell key="game-picker" title="RETRO GAMES" onClose={onClose}>
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

        {/* Stats */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t" style={{ color: "#6B7280" }}>
          {availableGames.length} games available
        </div>
      </div>
    </WindowShell>
  )
}
