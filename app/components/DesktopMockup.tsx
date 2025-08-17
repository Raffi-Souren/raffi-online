import React from 'react'
import MinesweeperGame from './MinesweeperGame'

export default function DesktopMockup() {
  return (
    <div className="relative w-full max-w-[800px] h-[600px] md:h-[80vh] bg-gray-800 rounded-lg shadow-xl overflow-hidden mx-auto">
      {/* Monitor frame */}
      <div className="absolute inset-2 bg-gray-100 rounded-md overflow-hidden">
        {/* Screen content */}
        <div className="w-full h-full bg-gray-100 relative p-4">
          <div className="w-full h-full bg-gray-300 border-t-2 border-l-2 border-white border-r-2 border-b-2 border-gray-500">
            <div className="bg-gray-200 p-1 border-t border-l border-white border-r border-b border-gray-500">
              <div className="flex justify-between items-center bg-blue-900 text-white px-2 py-1">
                <span>Minesweeper</span>
                <button className="bg-gray-300 text-black px-2 leading-none">×</button>
              </div>
              <MinesweeperGame />
            </div>
          </div>
        </div>
      </div>
      {/* Monitor stand */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-10 bg-gray-700 rounded-t-lg"></div>
    </div>
  )
}

