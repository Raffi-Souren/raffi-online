"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Bomb, Flag, Timer, Trophy, X } from "lucide-react"
import ScoreEntry from "./ScoreEntry"
import { useWindowActivity } from "../../components/ui/WindowShell"
import { readGameStorage, writeGameStorage } from "@/lib/game-utils"
import { usePersonalBest } from "@/lib/personal-bests"

const DIFFICULTIES = {
  easy: { label: "Easy", rows: 9, cols: 9, mines: 10 },
  normal: { label: "Normal", rows: 10, cols: 10, mines: 15 },
  hard: { label: "Hard", rows: 12, cols: 12, mines: 26 },
} as const

type Difficulty = keyof typeof DIFFICULTIES
type Status = "ready" | "playing" | "lost" | "won"
type CellState = "hidden" | "revealed" | "flagged"

interface Cell {
  isMine: boolean
  neighborMines: number
  state: CellState
  exploded?: boolean
}

const DIFFICULTY_KEY = "raffi-minesweeper-difficulty"
const NUMBER_COLORS = ["", "#1d4ed8", "#15803d", "#b91c1c", "#6d28d9", "#92400e", "#0e7490", "#111827", "#4b5563"]

function forEachNeighbor(rows: number, cols: number, r: number, c: number, visit: (nr: number, nc: number) => void) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) visit(nr, nc)
    }
  }
}

function emptyGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ isMine: false, neighborMines: 0, state: "hidden" as CellState })),
  )
}

/** Plants mines outside the 3x3 around the first tap, so the first tap always opens an area. */
function plantMines(grid: Cell[][], mines: number, safeR: number, safeC: number) {
  const rows = grid.length
  const cols = grid[0].length
  const candidates: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.abs(r - safeR) > 1 || Math.abs(c - safeC) > 1) candidates.push([r, c])
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  for (const [r, c] of candidates.slice(0, mines)) grid[r][c].isMine = true
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let count = 0
      forEachNeighbor(rows, cols, r, c, (nr, nc) => {
        if (grid[nr][nc].isMine) count++
      })
      grid[r][c].neighborMines = count
    }
  }
}

function floodReveal(grid: Cell[][], startR: number, startC: number) {
  const rows = grid.length
  const cols = grid[0].length
  const stack: [number, number][] = [[startR, startC]]
  while (stack.length) {
    const [r, c] = stack.pop()!
    const cell = grid[r][c]
    if (cell.state !== "hidden") continue
    cell.state = "revealed"
    if (!cell.isMine && cell.neighborMines === 0) {
      forEachNeighbor(rows, cols, r, c, (nr, nc) => {
        if (grid[nr][nc].state === "hidden") stack.push([nr, nc])
      })
    }
  }
}

function isCleared(grid: Cell[][]) {
  return grid.every((row) => row.every((cell) => cell.isMine || cell.state === "revealed"))
}

export default function MinesweeperGame() {
  const { active } = useWindowActivity()
  const [pageVisible, setPageVisible] = useState(true)
  const gameActive = active && pageVisible
  const [difficulty, setDifficulty] = useState<Difficulty>("normal")
  const config = DIFFICULTIES[difficulty]
  const [grid, setGrid] = useState<Cell[][]>(() => emptyGrid(config.rows, config.cols))
  const [status, setStatus] = useState<Status>("ready")
  const [elapsedMs, setElapsedMs] = useState(0)
  const [runId, setRunId] = useState(0)
  const startedAt = useRef<number | null>(null)
  const pausedAt = useRef<number | null>(null)
  const [tapMode, setTapMode] = useState<"reveal" | "flag">("reveal")
  const [largeCells, setLargeCells] = useState(false)
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)
  const { best, isNew, submit, clearNew } = usePersonalBest(`minesweeper-${difficulty}`, "low")
  const ended = status === "lost" || status === "won"

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current)
    holdTimer.current = null
    touchStart.current = null
  }, [])

  const flagsPlaced = grid.flat().filter((cell) => cell.state === "flagged").length
  const minesLeft = config.mines - flagsPlaced

  const resetGame = useCallback(
    (next: Difficulty = difficulty) => {
      clearHold()
      clearNew()
      suppressClick.current = false
      const nextConfig = DIFFICULTIES[next]
      setGrid(emptyGrid(nextConfig.rows, nextConfig.cols))
      setStatus("ready")
      startedAt.current = null
      pausedAt.current = null
      setElapsedMs(0)
      setRunId((id) => id + 1)
    },
    [difficulty, clearHold, clearNew],
  )

  useEffect(() => {
    const saved = readGameStorage(DIFFICULTY_KEY)
    if (saved && saved in DIFFICULTIES && saved !== "normal") {
      setDifficulty(saved as Difficulty)
      resetGame(saved as Difficulty)
    }
    // Runs once to restore the saved difficulty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseDifficulty = (next: Difficulty) => {
    if (next === difficulty) return
    setDifficulty(next)
    writeGameStorage(DIFFICULTY_KEY, next)
    resetGame(next)
  }

  useEffect(() => {
    const blur = () => {
      clearHold()
      setPageVisible(false)
    }
    const focus = () => setPageVisible(!document.hidden)
    const visibility = () => {
      if (document.hidden) blur()
      else focus()
    }
    window.addEventListener("blur", blur)
    window.addEventListener("focus", focus)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      window.removeEventListener("blur", blur)
      window.removeEventListener("focus", focus)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [clearHold])

  useEffect(() => {
    if (!gameActive) {
      clearHold()
      if (startedAt.current !== null && pausedAt.current === null) {
        pausedAt.current = performance.now()
        if (!ended) setElapsedMs(Math.round(pausedAt.current - startedAt.current))
      }
    } else if (pausedAt.current !== null) {
      // Exclude the entire hidden interval, including time after the last timer tick.
      if (startedAt.current !== null) startedAt.current += performance.now() - pausedAt.current
      pausedAt.current = null
    }
  }, [gameActive, ended, clearHold])

  useEffect(() => {
    if (!gameActive || status !== "playing") return
    const timer = window.setInterval(() => {
      if (startedAt.current !== null) setElapsedMs(Math.round(performance.now() - startedAt.current))
    }, 100)
    return () => window.clearInterval(timer)
  }, [gameActive, status])

  const finish = useCallback(
    (next: Grid, outcome: "lost" | "won") => {
      const ms = Math.round(performance.now() - (startedAt.current ?? performance.now()))
      setElapsedMs(ms)
      if (outcome === "won") {
        next.forEach((row) => row.forEach((cell) => {
          if (cell.isMine) cell.state = "flagged"
        }))
        submit(ms)
      } else {
        next.forEach((row) => row.forEach((cell) => {
          if (cell.isMine && cell.state === "hidden") cell.state = "revealed"
        }))
      }
      setStatus(outcome)
    },
    [submit],
  )

  const reveal = useCallback(
    (r: number, c: number) => {
      if (!gameActive || ended) return
      const current = grid[r][c]
      const next: Grid = grid.map((row) => row.map((cell) => ({ ...cell })))

      if (current.state === "revealed") {
        // Chording: a satisfied number opens every unflagged neighbour.
        if (current.neighborMines === 0) return
        let flags = 0
        forEachNeighbor(config.rows, config.cols, r, c, (nr, nc) => {
          if (next[nr][nc].state === "flagged") flags++
        })
        if (flags !== current.neighborMines) return
        let hitMine = false
        forEachNeighbor(config.rows, config.cols, r, c, (nr, nc) => {
          const cell = next[nr][nc]
          if (cell.state !== "hidden") return
          if (cell.isMine) {
            cell.state = "revealed"
            cell.exploded = true
            hitMine = true
          } else floodReveal(next, nr, nc)
        })
        if (hitMine) finish(next, "lost")
        else if (isCleared(next)) finish(next, "won")
        setGrid(next)
        return
      }

      if (current.state !== "hidden") return
      if (status === "ready") {
        plantMines(next, config.mines, r, c)
        startedAt.current = performance.now()
        setStatus("playing")
      }

      if (next[r][c].isMine) {
        next[r][c].state = "revealed"
        next[r][c].exploded = true
        finish(next, "lost")
      } else {
        floodReveal(next, r, c)
        if (isCleared(next)) finish(next, "won")
      }
      setGrid(next)
    },
    [gameActive, ended, grid, status, config, finish],
  )

  const toggleFlag = useCallback(
    (r: number, c: number) => {
      if (!gameActive || ended) return
      const cell = grid[r][c]
      if (cell.state === "revealed") {
        reveal(r, c)
        return
      }
      const next = grid.map((row) => row.map((item) => ({ ...item })))
      next[r][c].state = cell.state === "flagged" ? "hidden" : "flagged"
      setGrid(next)
    },
    [gameActive, ended, grid, reveal],
  )

  useEffect(() => clearHold, [clearHold])

  const describe = (cell: Cell) => {
    if (cell.state === "flagged") return ended && !cell.isMine ? "wrong flag" : "flagged"
    if (cell.state === "hidden") return "hidden"
    if (cell.isMine) return cell.exploded ? "exploded mine" : "mine"
    return `${cell.neighborMines} adjacent mines`
  }

  const cellBackground = (cell: Cell) => {
    if (cell.state === "revealed") return cell.exploded ? "#dc2626" : cell.isMine ? "#fca5a5" : "#f3f4f6"
    if (cell.state === "flagged" && ended && !cell.isMine) return "#fde68a"
    return "#c7ccd3"
  }

  const iconSize = largeCells ? 18 : config.cols > 10 ? 13 : 15
  const cellContent = (cell: Cell) => {
    if (cell.state === "flagged") {
      if (ended && !cell.isMine) return <X size={iconSize} aria-hidden="true" color="#b91c1c" strokeWidth={3} />
      return <Flag size={iconSize} aria-hidden="true" color="#b91c1c" fill="#ef4444" />
    }
    if (cell.state === "hidden") return null
    if (cell.isMine) return <Bomb size={iconSize} aria-hidden="true" color={cell.exploded ? "#fff" : "#111827"} />
    return cell.neighborMines > 0 ? cell.neighborMines : null
  }

  const seconds = (ms: number) => (ms / 1000).toFixed(1)
  const statusText =
    status === "lost" ? "Boom. Tap New game to try again." : status === "won" ? `Cleared in ${seconds(elapsedMs)}s` : status === "ready" ? "Tap any cell to start. The first tap is always safe." : "Tap a number with all its flags placed to clear around it."

  return (
    <div className="max-w-full" style={{ padding: 12, maxHeight: "100%", overflow: "auto", color: "#1e293b", background: "#e5e7eb" }}>
      <div role="group" aria-label="Difficulty" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={difficulty === key}
            onClick={() => chooseDifficulty(key)}
            style={{
              flex: 1,
              minHeight: 44,
              border: "1px solid #64748b",
              borderRadius: 5,
              background: difficulty === key ? "#245ab5" : "#f8fafc",
              color: difficulty === key ? "#fff" : "#1e293b",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {DIFFICULTIES[key].label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 15 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label={`${minesLeft} mines left to flag`}>
          <Flag size={16} aria-hidden="true" color="#b91c1c" /> {minesLeft}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label={`Elapsed time ${seconds(elapsedMs)} seconds`}>
          <Timer size={16} aria-hidden="true" /> {seconds(elapsedMs)}s
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#475569", fontSize: 13 }} aria-label={best ? `Best ${config.label} time ${seconds(best)} seconds` : `No ${config.label} best yet`}>
          <Trophy size={15} aria-hidden="true" /> {best ? `${seconds(best)}s` : "--"}
        </span>
        <button
          type="button"
          onClick={() => resetGame()}
          style={{ minHeight: 44, padding: "0 14px", border: "1px solid #1e3a8a", borderRadius: 5, background: "#1d4ed8", color: "#fff", fontWeight: 700, fontSize: 14 }}
        >
          New game
        </button>
      </div>

      <div role="group" aria-label="Tap mode" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["reveal", "flag"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={tapMode === mode}
            onClick={() => setTapMode(mode)}
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "1px solid #64748b",
              borderRadius: 5,
              background: tapMode === mode ? "#334155" : "#f8fafc",
              color: tapMode === mode ? "#fff" : "#1e293b",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {mode === "reveal" ? <Bomb size={16} aria-hidden="true" /> : <Flag size={16} aria-hidden="true" />}
            {mode === "reveal" ? "Dig" : "Flag"}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={largeCells}
          onClick={() => setLargeCells((value) => !value)}
          style={{ minHeight: 44, padding: "0 10px", border: "1px solid #64748b", borderRadius: 5, background: "#f8fafc", color: "#1e293b", fontSize: 13 }}
        >
          {largeCells ? "Fit" : "Zoom"}
        </button>
      </div>

      <div style={{ width: "100%", overflowX: "auto", overscrollBehaviorX: "contain" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
            width: largeCells ? config.cols * 44 : "100%",
            maxWidth: largeCells ? undefined : 460,
            margin: "0 auto",
            minWidth: 260,
            border: "3px solid #475569",
            background: "#94a3b8",
            gap: 1,
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${runId}-${r}-${c}`}
                type="button"
                aria-label={`Row ${r + 1}, column ${c + 1}: ${describe(cell)}`}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  minWidth: 0,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  boxShadow: cell.state === "revealed" ? "none" : "inset 2px 2px 0 #eef2f7, inset -2px -2px 0 #8b95a3",
                  background: cellBackground(cell),
                  color: NUMBER_COLORS[cell.neighborMines],
                  fontWeight: 800,
                  fontSize: largeCells ? 18 : config.cols > 10 ? 14 : 16,
                  cursor: ended ? "default" : "pointer",
                  touchAction: "manipulation",
                  WebkitTouchCallout: "none",
                  userSelect: "none",
                }}
                onClick={(event) => {
                  if (event.detail > 0 && suppressClick.current) {
                    suppressClick.current = false
                    return
                  }
                  if (tapMode === "flag") toggleFlag(r, c)
                  else reveal(r, c)
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  if (!touchStart.current && !suppressClick.current) toggleFlag(r, c)
                }}
                onKeyDown={(event) => {
                  if (event.key.toLowerCase() === "f") {
                    event.preventDefault()
                    toggleFlag(r, c)
                  }
                }}
                onPointerDown={(event) => {
                  clearHold()
                  suppressClick.current = false
                  if (event.pointerType === "mouse" || cell.state === "revealed") return
                  touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
                  holdTimer.current = setTimeout(() => {
                    suppressClick.current = true
                    holdTimer.current = null
                    if (tapMode === "flag") reveal(r, c)
                    else toggleFlag(r, c)
                    navigator.vibrate?.(15)
                  }, 400)
                }}
                onPointerMove={(event) => {
                  const touch = touchStart.current
                  if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) {
                    suppressClick.current = true
                    clearHold()
                  }
                }}
                onPointerUp={clearHold}
                onPointerCancel={() => {
                  suppressClick.current = true
                  clearHold()
                }}
                disabled={!gameActive || ended}
              >
                {cellContent(cell)}
              </button>
            )),
          )}
        </div>
      </div>

      <p role="status" style={{ margin: "10px 0 0", textAlign: "center", fontSize: 14, lineHeight: 1.5, fontWeight: ended ? 700 : 400, color: status === "lost" ? "#b91c1c" : status === "won" ? "#15803d" : "#475569" }}>
        {statusText}
        {status === "won" && isNew && ` New ${config.label} best!`}
      </p>

      {status === "won" && difficulty === "normal" && (
        <ScoreEntry key={`minesweeper-${runId}`} gameName="minesweeper" score={elapsedMs} level={1} />
      )}

      <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: "#64748b" }}>
        Hold a cell to {tapMode === "flag" ? "dig" : "flag"}. Right click or F also flags.
        {difficulty !== "normal" && " Leaderboard times come from Normal."}
      </p>
    </div>
  )
}

type Grid = Cell[][]
