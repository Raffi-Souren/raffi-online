"use client"

import { useState, useEffect } from "react"
import WindowShell from "../../components/ui/WindowShell"

interface UnderConstructionWindowProps {
  title: string
  onClose: () => void
}

export default function UnderConstructionWindow({ title, onClose }: UnderConstructionWindowProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <WindowShell id="under-construction" title={`${title.toUpperCase()} - COMING SOON`} isOpen={true} onClose={onClose}>
      <div className="content-section text-center py-12">
        <div className="text-6xl mb-6">🚧</div>
        <h2 className="section-title mb-4">Under Construction</h2>
        <p className="text-sm text-gray-600 mb-6">
          {title} is currently being built{dots}
        </p>
        <div className="space-y-2 text-xs text-gray-500">
          <p>This feature will be available soon!</p>
          <p>Check back later for updates.</p>
        </div>
        <div className="mt-8">
          <button onClick={onClose} className="xp-button bg-blue-100 hover:bg-blue-200">
            Close
          </button>
        </div>
      </div>
    </WindowShell>
  )
}
