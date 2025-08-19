"use client"

import { useEffect, useRef } from "react"
import type React from "react"

interface WindowShellProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function WindowShell({ title, onClose, children, className = "" }: WindowShellProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Focus & body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    ref.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden ${className}`}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between p-4 text-white">
          <div className="font-semibold text-lg truncate pr-2">{title}</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Content area with proper scrolling */}
        <div className="bg-white rounded-t-lg max-h-[calc(90vh-80px)] overflow-y-auto">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
