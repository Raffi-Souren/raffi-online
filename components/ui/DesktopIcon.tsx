"use client"

import Image from "next/image"

interface DesktopIconProps {
  icon: string
  label: string
  onClick: () => void
}

export default function DesktopIcon({ icon, label, onClick }: DesktopIconProps) {
  const iconMap: Record<string, string> = {
    "👤": "/icons/user.jpg",
    "🌐": "/icons/globe.jpg", 
    "🎮": "/icons/gamepad.jpg",
    "📝": "/icons/notepad.jpg",
    "💡": "/icons/lightbulb.jpg",
  }

  const iconSrc = iconMap[icon] || icon

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 p-2 rounded hover:bg-blue-500/20 transition-colors cursor-pointer group"
      style={{ pointerEvents: 'auto' }}
      type="button"
    >
      <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
        <span 
          className="text-4xl md:text-5xl select-none"
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
          }}
        >
          {icon}
        </span>
      </div>
      <span 
        className="text-white text-xs md:text-sm font-bold text-center leading-tight px-1 max-w-[80px]"
        style={{
          textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9)'
        }}
      >
        {label}
      </span>
    </button>
  )
}
