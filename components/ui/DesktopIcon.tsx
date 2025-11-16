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

  const iconSrc = iconMap[icon]

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 p-2 rounded hover:bg-blue-500/20 transition-colors cursor-pointer group"
      style={{ pointerEvents: 'auto' }}
      type="button"
    >
      <div 
        style={{
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: 'transparent'
        }}
      >
        {iconSrc ? (
          <Image
            src={iconSrc || "/placeholder.svg"}
            alt={label}
            width={64}
            height={64}
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
              objectFit: 'contain',
              backgroundColor: 'transparent'
            }}
            unoptimized
          />
        ) : (
          <span 
            style={{
              fontSize: '3rem',
              userSelect: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
              background: 'transparent'
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <span 
        style={{
          color: 'white',
          fontSize: '0.875rem',
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: '1.25',
          padding: '0 0.25rem',
          maxWidth: '80px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9)'
        }}
      >
        {label}
      </span>
    </button>
  )
}
