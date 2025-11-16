"use client"

interface DesktopIconProps {
  icon: string
  label: string
  onClick: () => void
}

export default function DesktopIcon({ icon, label, onClick }: DesktopIconProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded hover:bg-white/20 transition-colors cursor-pointer min-w-[80px] min-h-[90px]"
      type="button"
      aria-label={label}
    >
      <span className="text-4xl md:text-5xl select-none">{icon}</span>
      <span className="text-white text-xs md:text-sm font-semibold text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight max-w-[90px]">
        {label}
      </span>
    </button>
  )
}
