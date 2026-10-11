"use client"

import Image from "next/image"
import { useId } from "react"

interface DesktopIconProps {
  icon: string
  label: string
  description?: string
  onClick: () => void
}

export default function DesktopIcon({ icon, label, description, onClick }: DesktopIconProps) {
  const descriptionId = useId()
  const iconMap: Record<string, string> = {
    "👤": "/icons/raf-logo.png",
    "🌐": "/icons/globe.jpg", 
    "🎮": "/icons/gamepad.jpg",
    "📝": "/icons/notepad.jpg",
    "💡": "/icons/lightbulb.jpg",
    "🎧": "/icons/ipod.png",
  }

  const iconSrc = iconMap[icon]

  return (
    <button
      className="group focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      onClick={onClick}
      style={{
        display: 'flex',
        position: 'relative',
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
        border: 'none',
        minWidth: '80px',
        minHeight: '90px',
        width: '100%',
        maxWidth: '100px'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      type="button"
      aria-label={label}
      aria-describedby={description ? descriptionId : undefined}
    >
      {/* Icon Container */}
      <div 
        style={{
          width: '48px',
          height: '48px',
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
            alt=""
            width={48}
            height={48}
            draggable={false}
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'contain',
              userSelect: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
            }}
          />
        ) : (
          <span 
            style={{
              fontSize: '2.5rem',
              userSelect: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
              background: 'transparent'
            }}
          >
            {icon}
          </span>
        )}
      </div>
      
      {/* Label */}
      <span 
        style={{
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textAlign: 'center',
          lineHeight: '1.2',
          padding: '0 0.25rem',
          maxWidth: '80px',
          wordBreak: 'break-word',
          textShadow: '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9)'
        }}
      >
        {label}
      </span>
      {description && (
        <span
          id={descriptionId}
          role="tooltip"
          className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
          style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: "max-content", maxWidth: 170, padding: "5px 8px", border: "1px solid #9b9474", borderRadius: 3, background: "#fffde8", color: "#353b45", fontSize: 11, fontWeight: 400, lineHeight: 1.4, textAlign: "center", boxShadow: "0 2px 5px #0002", pointerEvents: "none", zIndex: 30 }}
        >{description}</span>
      )}
    </button>
  )
}
