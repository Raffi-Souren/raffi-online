'use client'

import { useState, useEffect } from 'react'
import { WindowsIcons } from './Icons'

export default function EasterEgg() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    const moveIcon = () => {
      const maxX = window.innerWidth - 40
      const maxY = window.innerHeight - 40
      setPosition({
        x: Math.random() * maxX,
        y: Math.random() * maxY
      })
    }

    const interval = setInterval(moveIcon, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div
        className="mario-box absolute transition-all duration-1000 cursor-pointer"
        style={{ left: position.x, top: position.y }}
        onClick={() => setIsRevealed(true)}
      >
        <div className="mario-box-inner">?</div>
      </div>

      {isRevealed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="window w-[400px]">
            <div className="window-title">
              {WindowsIcons.Info} Secret Found!
              <button 
                className="ml-auto"
                onClick={() => setIsRevealed(false)}
              >
                {WindowsIcons.Close}
              </button>
            </div>
            <div className="window-content">
              <div className="flex items-center gap-4 mb-4">
                {WindowsIcons.Success}
                <div>
                  <div className="font-bold">Congratulations!</div>
                  <div className="text-sm">You've found a secret track!</div>
                </div>
              </div>
              <iframe
                width="100%"
                height="166"
                scrolling="no"
                frameBorder="no"
                src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/YOUR_TRACK_ID"
              ></iframe>
              <div className="mt-4 flex justify-end">
                <button 
                  className="win-btn"
                  onClick={() => setIsRevealed(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
