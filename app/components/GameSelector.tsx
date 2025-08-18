"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Smartphone, Music, Gamepad, Radio, Phone, Monitor } from "lucide-react"

type Device = "blackberry" | "ipod" | "webgames" | "psp" | "razor" | "desktop" | null

const games = [
  {
    id: "blackberry",
    name: "Blackberry",
    url: "/games/brickbreaker",
    description: "Play Brickbreaker",
  },
  {
    id: "ipod",
    name: "iPod Classic",
    url: "/games/parachute",
    description: "Play Parachute",
  },
  {
    id: "razor",
    name: "Motorola Razr",
    url: "/games/snake",
    description: "Play Snake",
  },
  {
    id: "desktop",
    name: "Desktop PC",
    url: "/games/minesweeper",
    description: "Play Minesweeper",
  },
  {
    id: "webgames",
    name: "Web Games",
    url: "/games/webgameshub",
    description: "Classic Arcade Games",
  },
  {
    id: "psp",
    name: "Emulator",
    url: "/games/retroemulator",
    description: "Retro Console Games",
  },
]

export default function GameSelector() {
  const [selectedGame, setSelectedGame] = useState<Device>(null)

  const devices = [
    {
      id: "blackberry",
      name: "Blackberry",
      icon: Smartphone,
      description: "Play Brickbreaker",
      color: "bg-gray-900",
    },
    {
      id: "ipod",
      name: "iPod Classic",
      icon: Music,
      description: "Play Parachute",
      color: "bg-zinc-200",
    },
    {
      id: "razor",
      name: "Motorola Razr",
      icon: Phone,
      description: "Play Snake",
      color: "bg-pink-600",
    },
    {
      id: "desktop",
      name: "Desktop PC",
      icon: Monitor,
      description: "Play Minesweeper",
      color: "bg-blue-700",
    },
    {
      id: "webgames",
      name: "Web Games",
      icon: Gamepad,
      description: "Classic Arcade Games",
      color: "bg-green-600",
    },
    {
      id: "psp",
      name: "Emulator",
      icon: Radio,
      description: "Retro Console Games",
      color: "bg-blue-900",
    },
  ]

  if (selectedGame) {
    const game = games.find((g) => g.id === selectedGame)
    return (
      <div className="game-container">
        <div className="flex justify-between items-center mb-4 p-4 bg-gray-800 rounded-t-lg shrink-0">
          <h2 className="text-xl font-bold text-white">{game?.name}</h2>
          <button
            onClick={() => setSelectedGame(null)}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Close
          </button>
        </div>

        <div className="game-content">
          <div
            className="relative w-full bg-white rounded-lg overflow-hidden"
            style={{ aspectRatio: "4/3", minHeight: "400px" }}
          >
            <iframe
              src={game?.url}
              className="w-full h-full border-0"
              loading="lazy"
              title={game?.name}
              tabIndex={0}
              allow="fullscreen; gamepad; autoplay"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
            <p>
              <strong>Game Info:</strong> {game?.description}. Games are embedded from their original sources. Click
              inside the game area to ensure keyboard focus. Some games may require clicking "Play" or similar buttons
              to start.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 max-w-3xl mx-auto">
      {devices.map((device) => (
        <Card
          key={device.id}
          className={`p-6 cursor-pointer transition-transform hover:scale-105 ${device.color} text-white`}
          onClick={() => setSelectedGame(device.id as Device)}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <device.icon size={48} />
            <div>
              <h3 className="font-bold text-lg">{device.name}</h3>
              <p className="text-sm opacity-80">{device.description}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
