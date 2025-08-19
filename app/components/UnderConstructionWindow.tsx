"use client"

import WindowShell from "../../components/ui/WindowShell"

interface UnderConstructionWindowProps {
  isOpen: boolean
  onClose: () => void
  title: string
}

export default function UnderConstructionWindow({ isOpen, onClose, title }: UnderConstructionWindowProps) {
  if (!isOpen) return null

  return (
    <WindowShell title={title} onClose={onClose}>
      <div className="text-center py-12">
        <div className="text-6xl mb-6">🚧</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Under Construction</h2>
        <p className="text-gray-600 mb-6">This feature is currently being built. Check back soon!</p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </WindowShell>
  )
}
