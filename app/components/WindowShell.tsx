"use client"

import { type ReactNode, useEffect } from "react"
import { X } from "lucide-react"

interface WindowShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export default function WindowShell({ title, onClose, children, className = "" }: WindowShellProps) {
  // Lock body scroll while window is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 md:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Window */}
      <div
        className={`
          relative w-[min(92vw,960px)] max-h-[min(88vh,900px)]
          bg-gray-900 border border-gray-700 rounded-lg shadow-2xl
          overflow-hidden pointer-events-auto
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: "calc(min(88vh, 900px) - 80px)" }}>
          {children}
        </div>
      </div>
    </div>
  )
}
