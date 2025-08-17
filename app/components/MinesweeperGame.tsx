'use client'

import React, { useState, useEffect } from 'react'

const GRID_SIZE = 10
const NUM_MINES = 15

type CellState = 'hidden' | 'revealed' | 'flagged'

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

  useEffect(() => {
    initializeGrid()
  }, [])

  const initializeGrid = () => {
    const newGrid: Cell[][] = []
    for (let i = 0; i < GRID_SIZE; i++) {
      newGrid[i] = []
      for (let j = 0; j < GRID_SIZE; j++) {
        newGrid[i][j] = { isMine: false, neighborMines: 0, state: 'hidden' }
      }
    }

    // Place mines
    let minesPlaced = 0
    while (minesPlaced < NUM_MINES) {
      const x = Math.floor(Math.random() * GRID_SIZE)
      const y = Math.floor(Math.random() * GRID_SIZE)
      if (!newGrid[x][y].isMine) {
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

    setGrid(newGrid)
    setGameOver(false)
    setGameWon(false)
    setFlagsLeft(NUM_MINES)
  }

  const countNeighborMines = (grid: Cell[][], x: number, y: number) => {
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
  }

  const handleCellClick = (x: number, y: number) => {
    if (gameOver || gameWon || grid[x][y].state === 'flagged') return

    const newGrid = [...grid]
    if (newGrid[x][y].isMine) {
      revealAllMines(newGrid)
      setGameOver(true)
    } else {
      revealCell(newGrid, x, y)
      if (checkWinCondition(newGrid)) {
        setGameWon(true)
      }
    }
    setGrid(newGrid)
  }

  const handleCellRightClick = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault()
    if (gameOver || gameWon) return

    const newGrid = [...grid]
    const cell = newGrid[x][y]

    if (cell.state === 'hidden' && flagsLeft > 0) {
      cell.state = 'flagged'
      setFlagsLeft(flagsLeft - 1)
    } else if (cell.state === 'flagged') {
      cell.state = 'hidden'
      setFlagsLeft(flagsLeft + 1)
    }

    setGrid(newGrid)
  }

  const revealCell = (grid: Cell[][], x: number, y: number) => {
    const cell = grid[x][y]
    if (cell.state !== 'hidden') return

    cell.state = 'revealed'

    if (cell.neighborMines === 0) {
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
  }

  const revealAllMines = (grid: Cell[][]) => {
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (grid[i][j].isMine) {
          grid[i][j].state = 'revealed'
        }
      }
    }
  }

  const checkWinCondition = (grid: Cell[][]) => {
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (!grid[i][j].isMine && grid[i][j].state !== 'revealed') {
          return false
        }
      }
    }
    return true
  }

  const getCellContent = (cell: Cell) => {
    if (cell.state === 'hidden') return ''
    if (cell.state === 'flagged') return '🚩'
    if (cell.isMine) return '💣'
    return cell.neighborMines > 0 ? cell.neighborMines : ''
  }

  const getCellColor = (cell: Cell) => {
    if (cell.state !== 'revealed') return 'bg-gray-300'
    if (cell.isMine) return 'bg-red-500'
    return 'bg-gray-100'
  }

  const getNumberColor = (num: number) => {
    const colors = ['blue', 'green', 'red', 'purple', 'maroon', 'turquoise', 'black', 'gray']
    return colors[num - 1] || 'black'
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>Flags left: {flagsLeft}</div>
        <button
          onClick={initializeGrid}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          New Game
        </button>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {grid.map((row, x) =>
          row.map((cell, y) => (
            <button
              key={`${x}-${y}`}
              className={`w-8 h-8 flex items-center justify-center border border-gray-400 ${getCellColor(
                cell
              )}`}
              onClick={() => handleCellClick(x, y)}
              onContextMenu={(e) => handleCellRightClick(e, x, y)}
            >
              <span
                className={`font-bold ${
                  cell.neighborMines > 0 ? `text-${getNumberColor(cell.neighborMines)}` : ''
                }`}
              >
                {getCellContent(cell)}
              </span>
            </button>
          ))
        )}
      </div>
      {gameOver && <div className="mt-4 text-red-500 font-bold">Game Over! You hit a mine.</div>}
      {gameWon && <div className="mt-4 text-green-500 font-bold">Congratulations! You won!</div>}
    </div>
  )
}
