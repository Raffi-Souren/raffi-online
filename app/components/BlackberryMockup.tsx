import React from 'react'
import Brickbreaker from './Brickbreaker'

export default function BlackberryMockup() {
  return (
    <div className="relative w-[350px] h-[600px] bg-gray-900 rounded-3xl shadow-xl overflow-hidden">
      {/* Phone top bezel */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-black rounded-t-3xl flex items-center justify-center">
        <div className="w-16 h-2 bg-gray-800 rounded-full"></div>
        <div className="absolute right-4 top-4 text-gray-400 text-xs">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Phone screen */}
      <div className="absolute top-12 left-4 right-4 bottom-20 bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Metallic frame around game */}
          <div className="absolute inset-2 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-1">
            <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
              <Brickbreaker />
            </div>
          </div>
        </div>
      </div>

      {/* Phone keyboard */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gray-900 grid grid-cols-5 gap-1 p-2">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-800 rounded-sm flex items-center justify-center text-gray-400 text-xs"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Phone side buttons */}
      <div className="absolute top-20 right-0 w-2 h-12 bg-gray-700 rounded-l-lg"></div>
      <div className="absolute top-40 right-0 w-2 h-12 bg-gray-700 rounded-l-lg"></div>
    </div>
  )
}
