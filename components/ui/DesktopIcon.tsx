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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem',
        padding: '0.5rem',
        borderRadius: '0.25rem',
        transition: 'background-color 0.2s',
        cursor: 'pointer',
        pointerEvents: 'auto',
        background: 'transparent',
        border: 'none'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      type="button"
    >
      {/* Icon Container */}
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
      </div>
      
      {/* Label */}
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
