'use client'

import { useState } from 'react'
import { WindowsIcons } from './Icons'

export default function SongOfTheDay() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="window">
      <div className="window-title">
        {WindowsIcons.Music} Poolsuite FM Player
      </div>
      <div className="window-content">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white flex items-center justify-center text-black font-bold">
            {WindowsIcons.Music}
          </div>
          <div>
            <div className="pyrex-text">Now Playing</div>
            <div className="canary-text">Elado - Blame</div>
            <div className="canary-text text-gray-400">Gare du Nord</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="win-btn">{WindowsIcons.Undo}</button>
          <button 
            className="win-btn"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? WindowsIcons.Pause : WindowsIcons.Play}
          </button>
          <button className="win-btn">{WindowsIcons.Redo}</button>
          <button className="win-btn ml-auto">{WindowsIcons.Favorite}</button>
        </div>
      </div>
    </div>
  )
}
