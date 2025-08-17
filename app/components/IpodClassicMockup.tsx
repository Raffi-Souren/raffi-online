import React from 'react'
import ParachuteGame from './ParachuteGame'

export default function IpodClassicMockup() {
  return (
    <div className="relative w-[300px] h-[500px] bg-zinc-200 rounded-[30px] shadow-xl overflow-hidden mx-auto">
      {/* iPod screen */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[220px] h-[176px] bg-gray-100 rounded-sm overflow-hidden">
        <ParachuteGame />
      </div>

      {/* Click wheel */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[180px] h-[180px] bg-white rounded-full">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-zinc-200"></div>
        </div>
        {/* Menu button */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-600">
          MENU
        </div>
        {/* Previous/Next buttons */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600">
          ⏮
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-600">
          ⏭
        </div>
        {/* Play/Pause button */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-600">
          ⏯
        </div>
      </div>
    </div>
  )
}
