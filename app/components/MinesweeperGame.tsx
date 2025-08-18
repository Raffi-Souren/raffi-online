"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"

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
  const [flagsLeft, setFlagsLeft] = useState(NUM_MINES)
  const [firstClick, setFirstClick] = useState(true)

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
    setFlagsLeft(NUM_MINES)
    setFirstClick(true)
  }, [initializeGrid])

  useEffect(() => {
    resetGame()
  }, [resetGame])

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
      if (gameOver || gameWon) return

      setGrid((currentGrid) => {
        let newGrid = [...currentGrid.map((row) => [...row])]

        if (firstClick) {
          // Regenerate grid to avoid mine on first click
          newGrid = initializeGrid(x, y)
          setFirstClick(false)
        }

        if (newGrid[x][y].state === "flagged") return currentGrid

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
            setGameWon(true)
          }
        }

        return newGrid
      })
    },
    [gameOver, gameWon, firstClick, initializeGrid, revealCell],
  )

  const handleCellRightClick = useCallback(
    (e: React.MouseEvent, x: number, y: number) => {
      e.preventDefault()
      if (gameOver || gameWon) return

      setGrid((currentGrid) => {
        const newGrid = [...currentGrid.map((row) => [...row])]
        const cell = newGrid[x][y]

        if (cell.state === "hidden" && flagsLeft > 0) {
          cell.state = "flagged"
          setFlagsLeft((prev) => prev - 1)
        } else if (cell.state === "flagged") {
          cell.state = "hidden"
          setFlagsLeft((prev) => prev + 1)
        }

        return newGrid
      })
    },
    [gameOver, gameWon, flagsLeft],
  )

  const getCellContent = (cell: Cell) => {
    if (cell.state === "hidden") return ""
    if (cell.state === "flagged") return "🚩"
    if (cell.isMine) return "💣"
    return cell.neighborMines > 0 ? cell.neighborMines.toString() : ""
  }

  const getCellStyle = (cell: Cell) => {
    let baseStyle =
      "w-6 h-6 flex items-center justify-center border border-gray-400 text-xs font-bold cursor-pointer select-none min-h-[24px] "

    if (cell.state === "hidden") {
      baseStyle += "bg-gray-300 hover:bg-gray-200 "
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
    <div className="p-4 max-w-full overflow-auto">
      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm">
          <span className="mr-4">🚩 {flagsLeft}</span>
          <span>💣 {NUM_MINES}</span>
        </div>
        <button
          onClick={resetGame}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 min-h-[44px]"
        >
          New Game
        </button>
      </div>

      <div className="grid grid-cols-10 gap-0 w-fit mx-auto border-2 border-gray-600 max-w-full overflow-auto">
        {grid.map((row, x) =>
          row.map((cell, y) => (
            <button
              key={`${x}-${y}`}
              className={getCellStyle(cell)}
              onClick={() => handleCellClick(x, y)}
              onContextMenu={(e) => handleCellRightClick(e, x, y)}
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
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-center">Left click to reveal • Right click to flag</div>
    </div>
  )
}
