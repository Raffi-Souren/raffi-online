"use client"

import { X } from "lucide-react"

interface StartMenuProps {
  isOpen: boolean
  onClose: () => void
  onOpenWindow: (windowName: string) => void
}

export default function StartMenu({ isOpen, onClose, onOpenWindow }: StartMenuProps) {
  if (!isOpen) return null

  const handlePitchStartup = () => {
    window.open("https://chatgpt.com/g/g-68a497212bfc81918b450e9ca7ee67ba-raf-os-terminal", "_blank")
    onClose()
  }

  const menuItems = [
    { icon: "👤", label: "About", action: () => onOpenWindow("about") },
    { icon: "🌐", label: "Blogroll", action: () => onOpenWindow("blogroll") },
    { icon: "🎮", label: "Games", action: () => onOpenWindow("games") },
    { icon: "📝", label: "Notes", action: () => onOpenWindow("notes") },
    { icon: "💡", label: "Pitch Startup", action: handlePitchStartup },
  ]

  return (
    <div className="fixed bottom-12 left-2 z-40">
      <div className="bg-gradient-to-b from-blue-500 to-blue-700 border-2 border-blue-400 rounded-t-lg shadow-2xl w-64">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-2 flex items-center justify-between rounded-t-md">
          <span className="text-white font-bold text-sm">Start Menu</span>
          <button onClick={onClose} className="text-white hover:bg-blue-700 rounded p-1">
            <X size={16} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-blue-600 rounded transition-colors text-left"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-blue-800 px-4 py-2 rounded-b-md">
          <div className="text-white text-xs text-center">v203</div>
        </div>
      </div>
    </div>
  )
}
