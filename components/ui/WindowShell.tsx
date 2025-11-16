"use client"

import type { ReactNode } from "react"
import { X } from 'lucide-react'

interface WindowShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  id?: string
}

export default function WindowShell({ title, onClose, children, className = "", id }: WindowShellProps) {
  console.log("[v0] WindowShell rendering. Title:", title, "ID:", id)
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div
        className={`bg-white rounded-lg shadow-2xl w-full h-full md:max-w-4xl md:w-full md:max-h-[90vh] md:h-auto flex flex-col ${className}`}
      >
        {/* Blue Title Bar */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 md:px-4 py-3 md:py-2 flex items-center justify-between rounded-t-lg">
          <h2 className="font-bold text-sm md:text-sm truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="hover:bg-blue-800 p-2 md:p-1 rounded transition-colors flex-shrink-0 touch-manipulation"
            aria-label="Close window"
          >
            <X size={18} className="md:w-4 md:h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </div>
    </div>
  )
}
