"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"

interface StartMenuProps {
  isOpen: boolean
  onClose: () => void
  onOpenWindow: (windowName: string) => void
}

export default function StartMenu({ isOpen, onClose, onOpenWindow }: StartMenuProps) {
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => firstItemRef.current?.focus({ preventScroll: true }))
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener("keydown", handleEscape, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("keydown", handleEscape, true)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const menuItems = [
    { icon: "👤", label: "About", action: () => onOpenWindow("about") },
    { icon: "🌐", label: "Blogroll", action: () => onOpenWindow("blogroll") },
    { icon: "🎮", label: "Games", action: () => onOpenWindow("games") },
    { icon: "🎧", label: "iPod", action: () => onOpenWindow("ipod") },
    { icon: "🛠️", label: "Projects", action: () => onOpenWindow("projects") },
    { icon: "📝", label: "Notes", action: () => onOpenWindow("notes") },
    { icon: "💡", label: "RAF OS TERMINAL", action: () => onOpenWindow("startup") },
  ]

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(44px + env(safe-area-inset-bottom, 0px))",
        left: "max(0.5rem, env(safe-area-inset-left, 0px))",
        width: "calc(100vw - 1rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))",
        maxWidth: "16rem",
        maxHeight: "calc(100dvh - 52px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
        zIndex: 9001,
      }}
      role="menu"
      aria-label="Start menu"
    >
      <div
        style={{
          background: "linear-gradient(to bottom, #3b82f6, #1d4ed8)",
          border: "2px solid #60a5fa",
          borderTopLeftRadius: "0.5rem",
          borderTopRightRadius: "0.5rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          width: "100%",
          maxHeight: "calc(100dvh - 52px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(to right, #2563eb, #1e40af)",
            padding: "0 0.5rem 0 1rem",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            borderTopLeftRadius: "0.375rem",
            borderTopRightRadius: "0.375rem",
          }}
        >
          <span
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            Start Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Start menu"
            style={{
              color: "white",
              borderRadius: "0.25rem",
              padding: 0,
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.2s",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Menu Items */}
        <div
          style={{
            padding: "0.5rem",
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            minHeight: 0,
            flex: "1 1 auto",
          }}
        >
          {menuItems.map((item, index) => (
            <button
              type="button"
              key={index}
              ref={index === 0 ? firstItemRef : undefined}
              role="menuitem"
              onClick={item.action}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.5rem 0.75rem",
                color: "white",
                borderRadius: "0.25rem",
                transition: "background-color 0.2s",
                textAlign: "left",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
                minHeight: "44px",
                WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <span style={{ fontSize: "1.125rem" }} aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#1e40af",
            padding: "0.5rem 1rem",
            borderBottomLeftRadius: "0.375rem",
            borderBottomRightRadius: "0.375rem",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: "0.75rem",
              textAlign: "center",
            }}
          >
            v303
          </div>
        </div>
      </div>
    </div>
  )
}
