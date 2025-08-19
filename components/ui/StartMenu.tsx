"use client"

interface StartMenuProps {
  onClose: () => void
  onOpenWindow: (windowName: string) => void
}

export function StartMenu({ onClose, onOpenWindow }: StartMenuProps) {
  const menuItems = [
    { icon: "ℹ️", label: "About", action: "about" },
    { icon: "🎮", label: "Retro Games", action: "games" },
    { icon: "🎵", label: "Digging in the Crates", action: "crates" },
    { icon: "🔗", label: "Blogroll", action: "blogroll" },
    { icon: "📝", label: "Notes", action: "notes" },
    { icon: "💡", label: "Pitch Me a Startup", action: "startup" },
    { icon: "🔢", label: "By the Numbers", action: "counter" },
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      {/* Menu */}
      <div className="fixed bottom-10 left-2 z-30 bg-gray-800 rounded-lg shadow-2xl border border-gray-600 min-w-48">
        <div className="p-2">
          <div className="text-white text-sm font-bold mb-2 px-2 py-1 border-b border-gray-600">Start Menu</div>
          {menuItems.map((item) => (
            <button
              key={item.action}
              onClick={() => onOpenWindow(item.action)}
              className="w-full flex items-center gap-3 px-2 py-2 text-white hover:bg-blue-600 rounded text-sm transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
