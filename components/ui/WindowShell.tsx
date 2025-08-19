"use client"
import { useEffect, useRef } from "react"
import type React from "react"

type WindowShellProps = {
  id: string
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export default function WindowShell({ id, title, isOpen, onClose, children, className }: WindowShellProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  // Focus & body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    ref.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 md:inset-auto md:absolute z-[60] flex items-center justify-center p-3"
      aria-labelledby={`${id}-title`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Window */}
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative mx-auto w-[92vw] md:w-[min(600px,88vw)] max-w-[700px] 
                   max-h-[calc(100dvh-80px)] overflow-hidden rounded-lg shadow-2xl ${className || ""}`}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between p-4 text-white">
          <div id={`${id}-title`} className="font-semibold text-lg truncate pr-2">
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md bg-red-500/90 hover:bg-red-500 
                       text-white font-bold text-sm transition-colors flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Content area with proper scrolling */}
        <div className="bg-white rounded-t-lg max-h-[calc(100dvh-160px)] overflow-y-auto overscroll-contain">
          <div className="p-4 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
