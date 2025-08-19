"use client"

import { useState, useEffect } from "react"
import { WindowShell } from "../../components/ui/WindowShell"

interface UnderConstructionWindowProps {
  isOpen: boolean
  onClose: () => void
  title: string
}

export function UnderConstructionWindow({ isOpen, onClose, title }: UnderConstructionWindowProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)

    return () => clearInterval(interval)
  }, [])

  if (!isOpen) return null

  return (
    <WindowShell title={`${title.toUpperCase()} - COMING SOON`} onClose={onClose}>
      <div className="text-center py-12">
        <div className="text-6xl mb-6">🚧</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Under Construction</h2>
        <p className="text-gray-600 mb-6">
          {title} is currently being built{dots}
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>This feature will be available soon!</p>
          <p>Check back later for updates.</p>
        </div>
        <div className="mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </WindowShell>
  )
}
