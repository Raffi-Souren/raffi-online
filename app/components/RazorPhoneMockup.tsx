import React from 'react'
import SnakeGame from './SnakeGame'

export default function RazorPhoneMockup() {
  return (
    <div className="relative w-[300px] h-[600px] bg-pink-600 rounded-[30px] shadow-xl overflow-hidden mx-auto">
      {/* Phone top */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gray-800 rounded-t-[30px]">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-2 bg-gray-700 rounded-full"></div>
      </div>

      {/* Phone screen */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[240px] h-[320px] bg-gray-200 rounded-sm overflow-hidden">
        <SnakeGame />
      </div>

      {/* Phone keypad */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[260px] grid grid-cols-3 gap-2">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-800 font-bold"
          >
            {i === 9 ? '*' : i === 10 ? '0' : i === 11 ? '#' : i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

