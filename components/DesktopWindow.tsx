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
    <div className="fixed inset-0 z-[3000] flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Window */}
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-[min(92vw,960px)]",
          "max-h-[min(88vh,900px)]",
          isYellow ? "bg-black border-2 border-[#ffd700]" : "bg-[#c0c0c0] border-2 border-[#c0c0c0]",
          "rounded-none shadow-2xl overflow-hidden",
          "pointer-events-auto",
          className || "",
        ].join(" ")}
        style={{
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
          border: isYellow ? "3px solid #ffd700" : "2px outset #c0c0c0",
        }}
      >
        {/* Title Bar */}
        <div
          className={[
            "sticky top-0 z-10 flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide",
            isYellow
              ? "bg-gradient-to-r from-[#ffd700] to-[#ffa500] text-black"
              : "bg-gradient-to-r from-[#0054e3] to-[#0041b8] text-white",
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
            isYellow ? "bg-black text-[#ffd700]" : "bg-[#c0c0c0] text-black",
          ].join(" ")}
          style={{
            maxHeight: "calc(min(88vh, 900px) - 40px)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="p-3 md:p-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
