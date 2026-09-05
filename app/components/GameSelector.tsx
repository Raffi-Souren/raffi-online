"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, Gamepad2, Search, Trophy } from "lucide-react"
import WindowShell from "../../components/ui/WindowShell"
import Leaderboard from "./Leaderboard"

const GAME_COMPONENTS = {
  "borough-gp": dynamic(() => import("./KartGame")),
  snake: dynamic(() => import("./SnakeGame")),
  parachute: dynamic(() => import("./ParachuteGame")),
  brickbreaker: dynamic(() => import("./Brickbreaker")),
  minesweeper: dynamic(() => import("./MinesweeperGame")),
  "signal-lost": dynamic(() => import("./SignalLostGame")),
  dockyard: dynamic(() => import("./DockyardGame")),
  "block-party-brawl": dynamic(() => import("./BlockPartyBrawl")),
}

type GameId = keyof typeof GAME_COMPONENTS

type GameCategory = "Originals" | "Handhelds" | "Desktop & arcade"

interface Game {
  id: GameId
  name: string
  device: string
  category: GameCategory
  description: string
  icon: string
  color: string
}

interface GameSelectorProps {
  isOpen: boolean
  onClose: () => void
}

const GAMES: Game[] = [
  {
    id: "borough-gp",
    name: "Borough Grand Prix",
    device: "Raffi Racing",
    category: "Originals",
    description: "Three laps. Five rivals. Drift along the Brooklyn waterfront.",
    icon: "🏎️",
    color: "#b7e2e2",
  },
  {
    id: "snake",
    name: "Snake",
    device: "Raffi Pocket",
    category: "Handhelds",
    description: "Keep growing. Keep clear of your own tail.",
    icon: "🐍",
    color: "#d0ddb0",
  },
  {
    id: "parachute",
    name: "Parachute",
    device: "Raffi Pocket",
    category: "Handhelds",
    description: "Time your jump. Avoid the helicopters. Stick the landing.",
    icon: "🪂",
    color: "#d4ddea",
  },
  {
    id: "brickbreaker",
    name: "Brick Breaker",
    device: "Raffi Pocket",
    category: "Handhelds",
    description: "Clear the bricks and keep the ball in play.",
    icon: "🧱",
    color: "#e8c4b2",
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    device: "Desktop PC",
    category: "Desktop & arcade",
    description: "Read the numbers. Flag the mines.",
    icon: "💣",
    color: "#d0d2d4",
  },
  {
    id: "block-party-brawl",
    name: "Block Party Brawl",
    device: "Arcade",
    category: "Originals",
    description: "Clear the block. Bring the sound system back.",
    icon: "🥊",
    color: "#e8d49a",
  },
  {
    id: "dockyard",
    name: "Dockyard",
    device: "Harbor strategy",
    category: "Originals",
    description: "Salvage, build and defend your corner of the harbor.",
    icon: "⚓",
    color: "#d9c6a7",
  },
  {
    id: "signal-lost",
    name: "Signal Lost",
    device: "Pulse blaster",
    category: "Originals",
    description: "Take back a Brooklyn substation from rogue speaker drones.",
    icon: "📡",
    color: "#d9bcc7",
  },
]

// Canvas games need a definite viewport height. Device-shaped games keep their
// intrinsic height and a top-aligned scroll origin so every control is reachable.
const VIEWPORT_GAMES = new Set<GameId>(["signal-lost", "block-party-brawl", "borough-gp", "dockyard"])
const CATEGORIES = ["All games", "Originals", "Handhelds", "Desktop & arcade"] as const

export default function GameSelector({ isOpen, onClose }: GameSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All games")
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
  const [leaderboardGame, setLeaderboardGame] = useState<GameId | null>(null)

  if (!isOpen) return null

  if (leaderboardGame) {
    return (
      <WindowShell key="game-scores" title="High scores" onClose={() => setLeaderboardGame(null)} maxWidth="560px">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setLeaderboardGame(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              minHeight: 40,
              padding: "6px 8px",
              color: "#294b67",
              fontSize: 13,
            }}
            className="hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <ArrowLeft size={15} /> Game shelf
          </button>
          <select
            aria-label="Leaderboard game"
            value={leaderboardGame}
            onChange={(event) => setLeaderboardGame(event.target.value as GameId)}
            style={{
              flex: "1 1 180px",
              minWidth: 0,
              minHeight: 40,
              padding: "6px 9px",
              color: "#253c50",
              background: "#fff",
              border: "1px solid #a0b0b9",
              borderRadius: 4,
            }}
          >
            {GAMES.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </div>
        <Leaderboard key={leaderboardGame} gameName={leaderboardGame} />
      </WindowShell>
    )
  }

  if (activeGame) {
    const game = GAMES.find((candidate) => candidate.id === activeGame)!
    const GameComponent = GAME_COMPONENTS[activeGame]
    const viewport = VIEWPORT_GAMES.has(activeGame)
    return (
      <WindowShell
        key={`game-${activeGame}`}
        title={`${game.name} — ${game.device}`}
        onClose={() => setActiveGame(null)}
        closeOnEscape={false}
        fill={viewport}
        fullBleed={viewport}
        compact={viewport}
        maxWidth={activeGame === "borough-gp" ? "1160px" : game.category === "Handhelds" ? "560px" : "1024px"}
      >
        <nav
          aria-label="Game navigation"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "5px 10px",
            background: "#e9ece2",
            borderBottom: "1px solid #aeb9b7",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveGame(null)}
            style={{
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
              minHeight: 32,
              padding: "4px 8px",
              fontSize: 12,
              color: "#294b67",
              fontWeight: 700,
              borderRadius: 3,
            }}
            className="hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <ArrowLeft size={15} /> Game shelf
          </button>
        </nav>
        {viewport ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "1 1 auto",
              minHeight: 0,
              position: "relative",
              overflowY: "auto",
            }}
          >
            <GameComponent />
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              display: "flex",
              width: "100%",
              minHeight: 360,
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: 12,
            }}
          >
            <GameComponent />
          </div>
        )}
      </WindowShell>
    )
  }

  const query = searchTerm.trim().toLowerCase()
  const filtered = GAMES.filter(
    (game) =>
      (category === "All games" || game.category === category) &&
      `${game.name} ${game.device} ${game.description}`.toLowerCase().includes(query),
  )

  return (
    <WindowShell key="game-picker" title="Games" onClose={onClose} maxWidth="820px">
      <div
        style={{ color: "#34434d", fontFamily: "'Trebuchet MS', Arial, sans-serif", padding: "clamp(4px, 2vw, 12px)" }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20 }}>
          <div
            style={{
              position: "relative",
              flexShrink: 0,
              width: 66,
              height: 74,
              borderRadius: "7px 7px 17px 7px",
              background: "#dedfd5",
              boxShadow: "inset 2px 2px 0 #f9f9ed, inset -3px -3px 0 #b1b6b0, 2px 3px 0 #d7d9d6",
              padding: "10px 9px",
            }}
            aria-hidden="true"
          >
            <div
              style={{
                background: "#8f9b70",
                border: "5px solid #657071",
                borderRadius: "3px 3px 7px 3px",
                height: 36,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Gamepad2 size={21} color="#344833" />
            </div>
            <span
              style={{ position: "absolute", bottom: 7, left: 12, fontWeight: 900, color: "#606969", fontSize: 17 }}
            >
              +
            </span>
            <span
              style={{
                position: "absolute",
                bottom: 9,
                right: 10,
                fontWeight: 900,
                letterSpacing: 2,
                color: "#934b70",
                fontSize: 14,
              }}
            >
              ••
            </span>
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(24px, 5vw, 32px)",
                fontWeight: 900,
                letterSpacing: "-1px",
                lineHeight: 1.05,
              }}
            >
              Pick up and play.
            </h2>
            <p style={{ margin: "7px 0 0", fontSize: 13, color: "#63727a" }}>
              Old favorites. A new route through Brooklyn.
            </p>
          </div>
        </header>

        <button
          type="button"
          onClick={() => setLeaderboardGame("snake")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            minHeight: 40,
            marginBottom: 14,
            padding: "8px 12px",
            border: "1px solid #b6a26d",
            borderRadius: 4,
            background: "#f3e7bd",
            color: "#574725",
            fontSize: 13,
            fontWeight: 700,
          }}
          className="hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <Trophy size={17} /> High scores
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#f4f5f0",
            border: "1px solid #bbc5c6",
            borderRadius: 5,
            padding: "0 11px",
            marginBottom: 12,
          }}
        >
          <Search size={17} aria-hidden="true" color="#66757b" />
          <input
            type="search"
            aria-label="Search games"
            placeholder="Find a game or device"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{
              minWidth: 0,
              width: "100%",
              background: "transparent",
              border: 0,
              padding: "11px 0",
              fontSize: 13,
              color: "#34434d",
            }}
            className="focus:outline-none"
          />
        </div>
        <div
          role="group"
          aria-label="Game categories"
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}
        >
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              style={{
                padding: "7px 10px",
                minHeight: 34,
                borderRadius: 4,
                border: `1px solid ${category === item ? "#64766a" : "#c5cbc4"}`,
                background: category === item ? "#d5dfbb" : "#f4f5ef",
                color: category === item ? "#344930" : "#53636c",
                fontSize: 12,
                fontWeight: category === item ? 700 : 400,
                boxShadow: category === item ? "inset 0 1px 2px #51694125" : "0 1px 0 #d7dcd4",
              }}
              className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {item}
            </button>
          ))}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}
        >
          {filtered.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              aria-label={`Play ${game.name}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                minWidth: 0,
                padding: 7,
                textAlign: "left",
                background: "#e6e7df",
                border: "1px solid #b1bab5",
                borderRadius: "7px 7px 14px 7px",
                boxShadow: "inset 1px 1px 0 #fff, inset -2px -2px 0 #ced2c8, 0 3px 0 #c3c9c0",
              }}
              className="hover:brightness-105 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <div
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  width: 65,
                  minHeight: 95,
                  background: game.color,
                  border: "1px solid #89968e70",
                  borderRadius: "3px 0 0 3px",
                  fontSize: 34,
                }}
              >
                {game.icon}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "9px 10px",
                  background: "#f9f8ed",
                  border: "1px solid #bec4b9",
                  borderLeft: 0,
                  borderRadius: "0 3px 6px 0",
                }}
              >
                <span style={{ display: "block", fontSize: 10, color: "#687972", marginBottom: 4 }}>{game.device}</span>
                <span
                  style={{
                    display: "block",
                    fontSize: 15,
                    fontWeight: 900,
                    lineHeight: 1.1,
                    color: "#344c55",
                    marginBottom: 5,
                  }}
                >
                  {game.name}
                </span>
                <span style={{ display: "block", fontSize: 11, lineHeight: 1.4, color: "#68747a" }}>
                  {game.description}
                </span>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div role="status" style={{ padding: "30px 12px", textAlign: "center", fontSize: 13 }}>
            No games match. Try another search or choose All games.
          </div>
        )}
      </div>
    </WindowShell>
  )
}
