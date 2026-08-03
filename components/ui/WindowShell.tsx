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
   * Fill the whole window with the child instead of sizing to content.
   *
   * Normal windows (About, Notes) size to their content, so the dialog has no
   * explicit height and `height: 100%` on any descendant collapses to `auto`.
   * Games need the opposite: a definite height to stretch into, and no padding
   * eating the frame. Opt in rather than changing every window.
   */
  fill?: boolean
  /** Keep stateful content mounted while its window is minimized. */
  hidden?: boolean
  /** Let an app own the content area edge-to-edge. */
  fullBleed?: boolean
  /** Override the standard desktop width cap. */
  maxWidth?: string
}

export default function WindowShell({
  title,
  onClose,
  children,
  className = "",
  id,
  fill = false,
  hidden = false,
  fullBleed = false,
  maxWidth = "1024px",
}: WindowShellProps) {
  const windowRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while window is open
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
          top: "max(8px, env(safe-area-inset-top, 0px))",
          left: "max(8px, env(safe-area-inset-left, 0px))",
          right: "max(8px, env(safe-area-inset-right, 0px))",
          bottom: "calc(48px + env(safe-area-inset-bottom, 0px))",
          maxHeight:
            "calc(100dvh - max(8px, env(safe-area-inset-top, 0px)) - 48px - env(safe-area-inset-bottom, 0px))",
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
            // A definite height is what lets `height: 100%` resolve further
            // down. Without it the dialog sizes to content and every nested
            // percentage height silently collapses to auto.
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
              padding: "0.75rem 1rem",
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
                minWidth: "44px",
                minHeight: "44px",
                width: "44px",
                height: "44px",
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
              // Containing block for any child's `absolute inset-0` overlay.
              // Without it those resolve against the fixed outer positioner and
              // escape the window frame entirely, covering the title bar.
              position: "relative",
              // Games own their whole frame; padding would letterbox them in
              // white and the scrollbar would sit on top of the canvas.
              padding: fullBleed || fill ? 0 : "1rem",
              display: fill ? "flex" : undefined,
              flexDirection: fill ? "column" : undefined,
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
