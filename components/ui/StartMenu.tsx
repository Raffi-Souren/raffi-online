"use client"

import { X } from "lucide-react"

interface StartMenuProps {
  onClose: () => void
  onOpenWindow: (windowName: string) => void
}

export default function StartMenu({ onClose, onOpenWindow }: StartMenuProps) {
  const menuItems = [
    { label: "About", icon: "👤", action: "about" },
    { label: "Games", icon: "🎮", action: "games" },
    { label: "Blogroll", icon: "🌐", action: "blogroll" },
    { label: "Notes", icon: "📝", action: "notes" },
    { label: "Digging in the Crates", icon: "🎵", action: "crates" },
    { label: "Pitch Me a Startup", icon: "💡", action: "startup" },
    { label: "By the Numbers", icon: "🔢", action: "counter" },
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Start Menu */}
      <div className="fixed bottom-12 left-0 w-64 bg-gradient-to-b from-blue-600 to-blue-700 border border-blue-500 rounded-tr-lg shadow-xl z-50">
        {/* Header */}
        <div className="bg-blue-800 text-white p-3 flex items-center justify-between rounded-tr-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏁</span>
            <span className="font-bold">Start Menu</span>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-700 p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          {menuItems.map((item) => (
            <button
              key={item.action}
              onClick={() => onOpenWindow(item.action)}
              className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-blue-600 rounded transition-colors text-left"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-blue-500 p-2">
          <div className="text-xs text-blue-200 text-center">Raffi Sourenkhatchadourian</div>
        </div>
      </div>
    </>
  )
}
