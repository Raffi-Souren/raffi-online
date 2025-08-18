"use client"

import { useState } from "react"

export default function WebGamesHub() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null)

  const games = [
    {
      id: "tetris",
      name: "Tetris",
      description: "Classic falling blocks puzzle game",
      url: "https://tetris.com/play-tetris",
      color: "bg-blue-500",
    },
    {
      id: "pacman",
      name: "Pac-Man",
      description: "Classic arcade maze game",
      url: "https://pacman.live/",
      color: "bg-yellow-500",
    },
    {
      id: "breakout",
      name: "Breakout",
      description: "Classic brick breaking game",
      url: "https://elgoog.im/breakout/",
      color: "bg-red-500",
    },
  ]

  if (selectedGame) {
    const game = games.find((g) => g.id === selectedGame)
    return (
      <div className="relative w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 p-4 bg-gray-800 rounded-t-lg">
          <h2 className="text-xl font-bold text-white">{game?.name}</h2>
          <button
            onClick={() => setSelectedGame(null)}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Close
          </button>
        </div>

        <div className="flex-1 bg-white rounded-lg overflow-hidden">
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
            inside the game area to ensure keyboard focus. Some games may require clicking "Play" or similar buttons to
            start.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Classic Web Games</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {games.map((game) => (
          <div
            key={game.id}
            className={`${game.color} p-6 rounded-lg cursor-pointer transition-transform hover:scale-105 text-white shadow-lg flex flex-col justify-center`}
            onClick={() => setSelectedGame(game.id)}
          >
            <h3 className="text-xl font-bold mb-2">{game.name}</h3>
            <p className="text-sm opacity-90 mb-4">{game.description}</p>
            <button className="bg-white bg-opacity-20 px-4 py-2 rounded hover:bg-opacity-30 transition-colors font-semibold">
              Play Now
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded text-sm text-gray-600 text-center">
        <p>
          <strong>How to Play:</strong> Click on any game above to start playing. Use keyboard controls for the best
          gaming experience. Games load in embedded frames from their original sources. If a game doesn't load
          immediately, try refreshing or clicking play within the game.
        </p>
      </div>
    </div>
  )
}
