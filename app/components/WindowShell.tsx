"use client"

import { type ReactNode, useEffect } from "react"
import useBodyScrollLock from "./hooks/useBodyScrollLock"

type Size = "sm" | "md" | "lg" | "xl"

interface WindowShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  size?: Size
  icon?: ReactNode
  isYellow?: boolean
}

export default function WindowShell({
  title,
  onClose,
  children,
  size = "md",
  icon,
  isYellow = false,
}: WindowShellProps) {
  useBodyScrollLock(true)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  // Get size classes - Fixed responsive sizing
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-[90vw] max-w-[400px] h-[70vh] max-h-[500px]"
      case "md":
        return "w-[95vw] max-w-[700px] h-[85vh] max-h-[600px]"
      case "lg":
        return "w-[96vw] max-w-[900px] h-[90vh] max-h-[700px]"
      case "xl":
        return "w-[98vw] max-w-[1100px] h-[92vh] max-h-[800px]"
      default:
        return "w-[95vw] max-w-[700px] h-[85vh] max-h-[600px]"
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`
          ${isYellow ? "yellow-window" : "window"}
          ${getSizeClasses()}
          flex flex-col
          relative
          overflow-hidden
        `}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Title Bar - Fixed height and clickable close */}
        <div className="window-title flex items-center gap-2 shrink-0 relative z-10">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate flex-1">{title}</span>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="shrink-0 hover:opacity-80 min-h-[32px] px-2 cursor-pointer bg-red-500 hover:bg-red-600 rounded text-white font-bold"
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Window Content - Properly scrollable */}
        <div className="window-content flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  )
}
