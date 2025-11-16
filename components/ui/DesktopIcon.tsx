"use client"

interface DesktopIconProps {
  icon: string
  label: string
  onClick: () => void
}

export default function DesktopIcon({ icon, label, onClick }: DesktopIconProps) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer group p-2 rounded hover:bg-white hover:bg-opacity-20 transition-all duration-200 relative"
      style={{
        minWidth: '80px',
        minHeight: '80px',
        zIndex: 10,
      }}
    >
      <div className="text-4xl md:text-5xl mb-2 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <span className="text-white text-xs md:text-sm font-medium text-center leading-tight drop-shadow-lg max-w-20 md:max-w-24">
        {label}
      </span>
    </div>
  )
}
