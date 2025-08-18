"use client"

import { useState } from "react"
import ParachuteGame from "./ParachuteGame"

export default function IpodClassicMockup() {
  const [gameKeys, setGameKeys] = useState<Record<string, boolean>>({})

  // Handle click wheel controls
  const handleControlClick = (key: string) => {
    // Simulate key press for the game
    const event = new KeyboardEvent("keydown", { key })
    window.dispatchEvent(event)

    // Brief visual feedback
    setGameKeys((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => {
      setGameKeys((prev) => ({ ...prev, [key]: false }))
    }, 150)
  }

  return (
    <div className="relative w-[280px] h-[480px] bg-zinc-200 rounded-[30px] shadow-xl overflow-hidden mx-auto">
      {/* iPod screen */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[200px] h-[150px] bg-gray-100 rounded-sm overflow-hidden border-2 border-gray-300">
        <ParachuteGame />
      </div>

      {/* Click wheel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[160px] h-[160px] bg-white rounded-full shadow-inner">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-zinc-200 shadow-md"></div>
        </div>

        {/* Menu button */}
        <button
          className={`absolute top-2 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-600 px-3 py-1 rounded transition-colors ${
            gameKeys["Escape"] ? "bg-blue-200" : "hover:bg-gray-100"
          }`}
          onTouchStart={(e) => {
            e.preventDefault()
            handleControlClick("Escape")
          }}
          onClick={(e) => {
            e.preventDefault()
            handleControlClick("Escape")
          }}
        >
          MENU
        </button>

        {/* Left button (Previous/Left) */}
        <button
          className={`absolute left-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-600 px-2 py-2 rounded transition-colors ${
            gameKeys["ArrowLeft"] ? "bg-blue-200" : "hover:bg-gray-100"
          }`}
          onTouchStart={(e) => {
            e.preventDefault()
            handleControlClick("ArrowLeft")
          }}
          onClick={(e) => {
            e.preventDefault()
            handleControlClick("ArrowLeft")
          }}
        >
          ⏮
        </button>

        {/* Right button (Next/Right) */}
        <button
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-600 px-2 py-2 rounded transition-colors ${
            gameKeys["ArrowRight"] ? "bg-blue-200" : "hover:bg-gray-100"
          }`}
          onTouchStart={(e) => {
            e.preventDefault()
            handleControlClick("ArrowRight")
          }}
          onClick={(e) => {
            e.preventDefault()
            handleControlClick("ArrowRight")
          }}
        >
          ⏭
        </button>

        {/* Play/Pause button (Start/Pause game) */}
        <button
          className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-600 px-3 py-1 rounded transition-colors ${
            gameKeys[" "] ? "bg-blue-200" : "hover:bg-gray-100"
          }`}
          onTouchStart={(e) => {
            e.preventDefault()
            handleControlClick(" ")
          }}
          onClick={(e) => {
            e.preventDefault()
            handleControlClick(" ")
          }}
        >
          ⏯
        </button>
      </div>

      {/* iPod branding */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-500 font-semibold">iPod</div>
    </div>
  )
}
