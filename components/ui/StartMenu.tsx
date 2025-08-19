"use client"

interface StartMenuProps {
  isOpen: boolean
  onOpenAbout: () => void
  onOpenBlogroll: () => void
  onOpenGames: () => void
  onOpenNotes: () => void
  onOpenEasterEgg: () => void
  onOpenEmail: () => void
}

export default function StartMenu({
  isOpen,
  onOpenAbout,
  onOpenBlogroll,
  onOpenGames,
  onOpenNotes,
  onOpenEasterEgg,
  onOpenEmail,
}: StartMenuProps) {
  if (!isOpen) return null

  return (
    <div className="fixed bottom-12 left-2 z-[70] bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-400 rounded-t-lg shadow-lg w-64">
      {/* Start Menu Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">RAF</div>
          <div className="text-sm font-bold">Raffi Sourenkhatchadourian</div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-2">
        <div className="space-y-1">
          <button onClick={onOpenAbout} className="start-menu-item">
            <span className="text-lg">👤</span>
            <span>About</span>
          </button>

          <button onClick={onOpenBlogroll} className="start-menu-item">
            <span className="text-lg">🌐</span>
            <span>Blogroll</span>
          </button>

          <button onClick={onOpenGames} className="start-menu-item">
            <span className="text-lg">🎮</span>
            <span>Games</span>
          </button>

          <button onClick={onOpenNotes} className="start-menu-item">
            <span className="text-lg">📝</span>
            <span>Notes</span>
          </button>

          <div className="border-t border-blue-300 my-2"></div>

          <button onClick={onOpenEasterEgg} className="start-menu-item">
            <span className="text-lg">🎧</span>
            <span>Digging in the Crates</span>
          </button>

          <button onClick={onOpenEmail} className="start-menu-item">
            <span className="text-lg">📧</span>
            <span>Contact</span>
          </button>
        </div>
      </div>
    </div>
  )
}
