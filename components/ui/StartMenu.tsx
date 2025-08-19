"use client"

import { X } from "lucide-react"

interface StartMenuProps {
  onClose: () => void
  onOpenWindow: (windowName: string) => void
}

export default function StartMenu({ onClose, onOpenWindow }: StartMenuProps) {
  const handleItemClick = (action: string) => {
    if (action === "startup") {
      // Open the ChatGPT link in a new tab
      window.open("https://chatgpt.com/g/g-68a497212bfc81918b450e9ca7ee67ba-raf-os-terminal", "_blank")
    } else if (action === "email") {
      try {
        const email = "raffi@notgoodcompany.com"
        const subject = "Contact from Website"
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`
        window.location.href = mailtoUrl
      } catch (error) {
        alert("Email: raffi@notgoodcompany.com")
      }
    } else {
      onOpenWindow(action)
    }
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Start Menu */}
      <div className="fixed bottom-12 left-0 z-50 bg-gradient-to-b from-blue-600 to-blue-700 border border-blue-500 rounded-tr-lg shadow-2xl w-64">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white px-4 py-2 flex items-center justify-between rounded-tr-lg">
          <span className="text-sm font-semibold">RAF OS</span>
          <button onClick={onClose} className="hover:bg-blue-900 p-1 rounded transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <button
            onClick={() => handleItemClick("about")}
            className="w-full text-left px-3 py-2 text-white hover:bg-blue-800 rounded flex items-center gap-3 transition-colors"
          >
            <span className="text-lg">👤</span>
            <span className="text-sm">About</span>
          </button>

          <button
            onClick={() => handleItemClick("blogroll")}
            className="w-full text-left px-3 py-2 text-white hover:bg-blue-800 rounded flex items-center gap-3 transition-colors"
          >
            <span className="text-lg">🌐</span>
            <span className="text-sm">Blogroll</span>
          </button>

          <button
            onClick={() => handleItemClick("games")}
            className="w-full text-left px-3 py-2 text-white hover:bg-blue-800 rounded flex items-center gap-3 transition-colors"
          >
            <span className="text-lg">🎮</span>
            <span className="text-sm">Games</span>
          </button>

          <button
            onClick={() => handleItemClick("notes")}
            className="w-full text-left px-3 py-2 text-white hover:bg-blue-800 rounded flex items-center gap-3 transition-colors"
          >
            <span className="text-lg">📝</span>
            <span className="text-sm">Notes</span>
          </button>

          <div className="border-t border-blue-500 my-2"></div>

          <button
            onClick={() => handleItemClick("startup")}
            className="w-full text-left px-3 py-2 text-white hover:bg-blue-800 rounded flex items-center gap-3 transition-colors"
          >
            <span className="text-lg">💡</span>
            <span className="text-sm">Pitch Startup</span>
          </button>

          <button
            onClick={() => handleItemClick("email")}
            className="w-full text-left px-3 py-2 text-white hover:bg-blue-800 rounded flex items-center gap-3 transition-colors"
          >
            <span className="text-lg">📧</span>
            <span className="text-sm">Contact</span>
          </button>
        </div>

        {/* Footer */}
        <div className="bg-blue-800 text-white text-xs px-4 py-2 border-t border-blue-500">
          <div className="flex justify-between items-center">
            <span>RAF OS</span>
            <span className="font-mono">v203</span>
          </div>
        </div>
      </div>
    </>
  )
}
