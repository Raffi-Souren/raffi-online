"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import ScoreEntry from "./ScoreEntry"

const GRID_SIZE = 10
const NUM_MINES = 15

type CellState = "hidden" | "revealed" | "flagged"

interface Cell {
  isMine: boolean
  neighborMines: number
  state: CellState
}

export default function MinesweeperGame() {
  const [grid, setGrid] = useState<Cell[][]>([])
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [firstClick, setFirstClick] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [runId, setRunId] = useState(0)
  const startedAt = useRef<number | null>(null)
  const touchStart = useRef<number | null>(null)
  const flagsLeft = NUM_MINES - grid.flat().filter((cell) => cell.state === "flagged").length

  const countNeighborMines = useCallback((grid: Cell[][], x: number, y: number) => {
    let count = 0
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue
        const newX = x + i
        const newY = y + j
        if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
          if (grid[newX][newY].isMine) count++
        }
      }
    }
    return count
  }, [])

  const initializeGrid = useCallback(
    (avoidX?: number, avoidY?: number) => {
      const newGrid: Cell[][] = []
      for (let i = 0; i < GRID_SIZE; i++) {
        newGrid[i] = []
        for (let j = 0; j < GRID_SIZE; j++) {
          newGrid[i][j] = { isMine: false, neighborMines: 0, state: "hidden" }
        }
      }

      // Place mines (avoid first click position)
      let minesPlaced = 0
      while (minesPlaced < NUM_MINES) {
        const x = Math.floor(Math.random() * GRID_SIZE)
        const y = Math.floor(Math.random() * GRID_SIZE)
        if (!newGrid[x][y].isMine && !(x === avoidX && y === avoidY)) {
          newGrid[x][y].isMine = true
          minesPlaced++
        }
      }

      // Calculate neighbor mines
      for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
          if (!newGrid[i][j].isMine) {
            newGrid[i][j].neighborMines = countNeighborMines(newGrid, i, j)
          }
        }
      }

      return newGrid
    },
    [countNeighborMines],
  )

  const resetGame = useCallback(() => {
    setGrid(initializeGrid())
    setGameOver(false)
    setGameWon(false)
    setFirstClick(true)
    startedAt.current = null
    setElapsedMs(0)
    setRunId((id) => id + 1)
  }, [initializeGrid])

  useEffect(() => {
    resetGame()
  }, [resetGame])

  useEffect(() => {
    if (firstClick || gameOver || gameWon) return
    const timer = window.setInterval(() => {
      if (startedAt.current !== null) setElapsedMs(Math.round(performance.now() - startedAt.current))
    }, 100)
    return () => window.clearInterval(timer)
  }, [firstClick, gameOver, gameWon])

  const revealCell = useCallback((grid: Cell[][], x: number, y: number) => {
    const cell = grid[x][y]
    if (cell.state !== "hidden") return

    cell.state = "revealed"

    if (cell.neighborMines === 0 && !cell.isMine) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue
          const newX = x + i
          const newY = y + j
          if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
            revealCell(grid, newX, newY)
          }
        }
      }
    }
  }, [])

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (gameOver || gameWon || grid[x][y].state !== "hidden") return

      let newGrid = grid.map((row) => row.map((cell) => ({ ...cell })))

      if (firstClick) {
        startedAt.current = performance.now()
        // Regenerate grid to avoid mine on first click
        newGrid = initializeGrid(x, y)
        grid.forEach((row, rowIndex) =>
          row.forEach((cell, columnIndex) => {
            if (cell.state === "flagged") newGrid[rowIndex][columnIndex].state = "flagged"
          }),
        )
        setFirstClick(false)
      }

      if (newGrid[x][y].isMine) {
        // Reveal all mines
        for (let i = 0; i < GRID_SIZE; i++) {
          for (let j = 0; j < GRID_SIZE; j++) {
            if (newGrid[i][j].isMine) {
              newGrid[i][j].state = "revealed"
            }
          }
        }
        setGameOver(true)
        setElapsedMs(Math.round(performance.now() - (startedAt.current ?? performance.now())))
      } else {
        revealCell(newGrid, x, y)

        // Check win condition
        let hiddenCells = 0
        for (let i = 0; i < GRID_SIZE; i++) {
          for (let j = 0; j < GRID_SIZE; j++) {
            if (!newGrid[i][j].isMine && newGrid[i][j].state !== "revealed") {
              hiddenCells++
            }
          }
        }
        if (hiddenCells === 0) {
          setElapsedMs(Math.round(performance.now() - (startedAt.current ?? performance.now())))
          setGameWon(true)
        }
      }

      setGrid(newGrid)
    },
    [grid, gameOver, gameWon, firstClick, initializeGrid, revealCell],
  )

  const toggleFlag = useCallback(
    (x: number, y: number) => {
      if (gameOver || gameWon) return

      const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })))
      const cell = newGrid[x][y]

      if (cell.state === "hidden" && flagsLeft > 0) {
        cell.state = "flagged"
      } else if (cell.state === "flagged") {
        cell.state = "hidden"
      }

      setGrid(newGrid)
    },
    [grid, gameOver, gameWon, flagsLeft],
  )

  const handleCellTouch = useCallback(
    (e: React.TouchEvent, x: number, y: number) => {
      e.preventDefault()
      if (touchStart.current === null) return
      const touchDuration = Date.now() - touchStart.current
      touchStart.current = null

      if (touchDuration > 500) {
        // Long press - flag/unflag
        toggleFlag(x, y)
      } else {
        // Short press - reveal
        handleCellClick(x, y)
      }
    },
    [handleCellClick, toggleFlag],
  )

  const handleTouchStart = useCallback(() => {
    touchStart.current = Date.now()
  }, [])

  const getCellContent = (cell: Cell) => {
    if (cell.state === "hidden") return ""
    if (cell.state === "flagged") return "🚩"
    if (cell.isMine) return "💣"
    return cell.neighborMines > 0 ? cell.neighborMines.toString() : ""
  }

  const getCellStyle = (cell: Cell) => {
    let baseStyle =
      "flex items-center justify-center border border-gray-400 text-xs font-bold cursor-pointer select-none "

    if (cell.state === "hidden") {
      baseStyle += "bg-gray-300 hover:bg-gray-200 active:bg-gray-400 "
    } else if (cell.state === "flagged") {
      baseStyle += "bg-yellow-200 "
    } else if (cell.isMine) {
      baseStyle += "bg-red-500 "
    } else {
      baseStyle += "bg-gray-100 "

      // Number colors
      if (cell.neighborMines === 1) baseStyle += "text-blue-600 "
      else if (cell.neighborMines === 2) baseStyle += "text-green-600 "
      else if (cell.neighborMines === 3) baseStyle += "text-red-600 "
      else if (cell.neighborMines === 4) baseStyle += "text-purple-600 "
      else if (cell.neighborMines === 5) baseStyle += "text-yellow-600 "
      else if (cell.neighborMines === 6) baseStyle += "text-pink-600 "
      else if (cell.neighborMines === 7) baseStyle += "text-black "
      else if (cell.neighborMines === 8) baseStyle += "text-gray-600 "
    }

    return baseStyle
  }

  return (
    <div className="p-4 max-w-full" style={{ maxHeight: "100%", overflow: "auto" }}>
      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm">
          <span className="mr-4">🚩 {flagsLeft}</span>
          <span className="mr-4">💣 {NUM_MINES}</span>
          <span aria-label={`Elapsed time ${(elapsedMs / 1000).toFixed(1)} seconds`}>
            ⏱ {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
        <button
          onClick={resetGame}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 min-h-[44px]"
        >
          New Game
        </button>
      </div>

      <div
        className="w-fit mx-auto border-2 border-gray-600"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 32px)`,
          gap: 0,
        }}
      >
        {grid.map((row, x) =>
          row.map((cell, y) => (
            <button
              key={`${x}-${y}`}
              aria-label={`Row ${x + 1}, column ${y + 1}: ${cell.state === "revealed" ? (cell.isMine ? "mine" : `${cell.neighborMines} adjacent mines`) : cell.state}`}
              className={getCellStyle(cell)}
              style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                minHeight: "32px",
              }}
              onClick={() => handleCellClick(x, y)}
              onContextMenu={(e) => {
                e.preventDefault()
                toggleFlag(x, y)
              }}
              onKeyDown={(e) => {
                if (e.key.toLowerCase() === "f") {
                  e.preventDefault()
                  toggleFlag(x, y)
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleCellTouch(e, x, y)}
              onTouchCancel={() => {
                touchStart.current = null
              }}
              disabled={gameOver || gameWon}
            >
              {getCellContent(cell)}
            </button>
          )),
        )}
      </div>

      {gameOver && (
        <div className="mt-4 text-center">
          <div className="text-red-500 font-bold text-lg">💥 Game Over!</div>
          <div className="text-sm text-gray-600">You hit a mine!</div>
        </div>
      )}

      {gameWon && (
        <div className="mt-4 text-center">
          <div className="text-green-500 font-bold text-lg">🎉 You Won!</div>
          <div className="text-sm text-gray-600">All mines found!</div>
          <ScoreEntry key={`minesweeper-${runId}`} gameName="minesweeper" score={elapsedMs} level={1} />
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-center">
        <div className="md:block hidden">Click or Enter to reveal • Right click or F to flag</div>
        <div className="md:hidden block">Tap to reveal • Long press to flag</div>
      </div>
    </div>
  )
}
