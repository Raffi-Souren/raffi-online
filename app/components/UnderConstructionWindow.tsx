"use client"

import WindowShell from "./WindowShell"

interface UnderConstructionWindowProps {
  title: string
  onClose: () => void
}

export default function UnderConstructionWindow({ title, onClose }: UnderConstructionWindowProps) {
  return (
    <WindowShell title={`${title.toUpperCase()} - UNDER CONSTRUCTION`} onClose={onClose} size="sm">
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-xl font-bold mb-4 text-yellow-400">UNDER CONSTRUCTION</h2>
        <p className="text-gray-300 mb-6">
          The <strong>{title}</strong> section is currently being built. Check back soon for updates!
        </p>
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-sm text-gray-400">This feature will be available in a future update.</p>
      </div>
    </WindowShell>
  )
}
