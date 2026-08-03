"use client"

import { type ReactNode, useEffect, useRef, useCallback } from "react"
import { X } from "lucide-react"

interface WindowShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  id?: string
  /**
   * Render the window tree but keep it off-screen. Used by windows that must
   * survive being dismissed — an iframe unmounted here would lose all of its
   * state — so closing hides instead of destroying. Every default below is the
   * pre-existing behaviour, so windows that ignore these props are unchanged.
   */
  hidden?: boolean
  /** Drop the content padding and scrolling so a canvas can reach the bezel. */
  fullBleed?: boolean
  /** Take the full available height rather than shrinking to fit content. */
  fill?: boolean
  /** Override the 1024px desktop cap for app-sized windows. */
  maxWidth?: string
  /**
   * Trim the window chrome to the minimum. On a short landscape phone the
   * normal 8px inset and roomy title bar cost ~30px of height, which is enough
   * to push a full-bleed game's own bottom HUD off its viewport.
   */
  compact?: boolean
}

export default function WindowShell({
  title,
  onClose,
  children,
  className = "",
  id,
  hidden = false,
  fullBleed = false,
  fill = false,
  maxWidth = "1024px",
  compact = false,
}: WindowShellProps) {
  const edgeInset = compact ? "0px" : "8px"
  const titlePadding = compact ? "0.25rem 0.5rem" : "0.75rem 1rem"
  const closeSize = compact ? "34px" : "44px"
  const windowRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while window is open. A hidden window is not on screen, so
  // it must not hold the lock or the desktop behind it would stay frozen.
  useEffect(() => {
    if (hidden) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [hidden])

  // Handle ESC key
  useEffect(() => {
    if (hidden) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [hidden, onClose])

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !windowRef.current) return
    const focusable = windowRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: "calc(40px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "calc(100dvh - 40px - env(safe-area-inset-bottom, 0px))",
          zIndex: 100,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: hidden ? "none" : undefined,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        style={{
          position: "fixed",
          top: `max(${edgeInset}, env(safe-area-inset-top, 0px))`,
          left: `max(${edgeInset}, env(safe-area-inset-left, 0px))`,
          right: `max(${edgeInset}, env(safe-area-inset-right, 0px))`,
          bottom: `calc(${compact ? "42px" : "48px"} + env(safe-area-inset-bottom, 0px))`,
          maxHeight: `calc(100dvh - max(${edgeInset}, env(safe-area-inset-top, 0px)) - ${
            compact ? "42px" : "48px"
          } - env(safe-area-inset-bottom, 0px))`,
          zIndex: 101,
          display: hidden ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
        aria-hidden={hidden ? "true" : undefined}
      >
        <div
          ref={windowRef}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-label={title}
          style={{
            backgroundColor: "#ffffff",
            color: "#111827",
            borderRadius: "0.5rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth,
            height: fill ? "100%" : undefined,
            maxHeight: "100%",
            pointerEvents: "auto",
            overflow: "hidden",
          }}
        >
          {/* Blue Title Bar - sticky positioning to always show */}
          <div
            style={{
              background: "linear-gradient(to right, #2563eb, #1d4ed8)",
              color: "white",
              padding: titlePadding,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTopLeftRadius: "0.5rem",
              borderTopRightRadius: "0.5rem",
              flexShrink: 0,
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <h2
              style={{
                fontWeight: "bold",
                fontSize: "1rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: "0.5rem",
                margin: 0,
              }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: 0,
                borderRadius: "0.25rem",
                transition: "background-color 0.2s",
                flexShrink: 0,
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 102,
                minWidth: closeSize,
                minHeight: closeSize,
                width: closeSize,
                height: closeSize,
                boxSizing: "border-box",
                WebkitTapHighlightColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"
              }}
              aria-label="Close window"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Content area */}
          <div
            style={{
              flex: "1 1 auto",
              overflowY: fullBleed ? "hidden" : "auto",
              overflowX: "hidden",
              padding: fullBleed ? 0 : "1rem",
              backgroundColor: fullBleed ? "#000000" : "#ffffff",
              color: "#111827",
              minHeight: 0,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
