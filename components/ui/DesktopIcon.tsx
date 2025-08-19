"use client"

interface DesktopIconProps {
  icon: string
  label: string
  onClick: () => void
}

export function DesktopIcon({ icon, label, onClick }: DesktopIconProps) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center p-2 rounded-lg hover:bg-white hover:bg-opacity-20 cursor-pointer transition-all duration-200 group"
    >
      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <div className="text-white text-xs text-center font-semibold drop-shadow-lg max-w-20 leading-tight">{label}</div>
    </div>
  )
}
