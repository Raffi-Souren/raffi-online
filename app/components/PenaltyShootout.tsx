'use client'

import { useState } from 'react'

export default function PenaltyShootout() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="bg-gray-100 p-6 rounded-lg">
      <h2 className="text-2xl font-serif mb-4">Penalty Shootout Game</h2>
      {!isPlaying ? (
        <button 
          onClick={() => setIsPlaying(true)}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          Play Game
        </button>
      ) : (
        <div className="relative w-full" style={{ paddingTop: '75%' }}>
          <iframe 
            src="https://your-github-username.github.io/penalty-shootout/index.html" 
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            frameBorder="0" 
            allowFullScreen
          ></iframe>
        </div>
      )}
    </div>
  )
}
