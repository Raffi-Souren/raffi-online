"use client"

import { useEffect, type ReactNode } from "react"

type Props = {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  isYellow?: boolean
}

export default function DesktopWindow({ title, isOpen, onClose, children, className, isYellow = false }: Props) {
  useEffect(() => {
    if (!isOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)

    // Lock body scroll while window is open
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-70" onClick={onClose} />

      {/* Window */}
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-[min(92vw,960px)]",
          "max-h-[85vh]",
          isYellow ? "bg-black border-2 border-yellow-400" : "bg-gray-200 border-2 border-gray-200",
          "rounded-none shadow-2xl overflow-hidden",
          "pointer-events-auto",
          className || "",
        ].join(" ")}
        style={{
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
          border: isYellow ? "3px solid #ffd700" : "2px outset #c0c0c0",
        }}
      >
        {/* Title Bar - Sticky */}
        <div
          className={[
            "sticky top-0 z-10 flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide",
            isYellow
              ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black"
              : "bg-gradient-to-r from-blue-600 to-blue-700 text-white",
          ].join(" ")}
          style={{ minHeight: "32px" }}
        >
          <span className="font-bold truncate">{title}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className={[
              "ml-auto inline-flex h-6 w-6 items-center justify-center text-sm font-bold",
              "hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white/50",
              isYellow ? "text-black hover:bg-black/10" : "text-white hover:bg-white/10",
            ].join(" ")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className={[
            "overflow-y-auto overflow-x-hidden",
            isYellow ? "bg-black text-yellow-400" : "bg-gray-200 text-black",
          ].join(" ")}
          style={{
            maxHeight: "calc(85vh - 40px)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="p-3 md:p-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
