"use client"

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"
import { Minus, X } from "lucide-react"

interface WindowActivityContextValue {
  active: boolean
  layer: number
  onActivate?: () => void
}

const WindowActivityContext = createContext<WindowActivityContextValue>({
  active: true,
  layer: 100,
})

/** Lets legacy/custom-chrome windows participate in the shared window stack. */
export function useWindowActivity() {
  return useContext(WindowActivityContext)
}

interface WindowActivityProviderProps {
  active: boolean
  layer: number
  onActivate?: () => void
  children: ReactNode
}

/**
 * Supplies shell-level focus and stacking state without forcing callers to
 * thread new props through every window component. Keeping each provider in a
 * stable DOM slot is especially important for iframe apps: moving an iframe to
 * bring it forward can reload its browsing context and destroy its state.
 */
export function WindowActivityProvider({
  active,
  layer,
  onActivate,
  children,
}: WindowActivityProviderProps) {
  const value = useMemo(() => ({ active, layer, onActivate }), [active, layer, onActivate])
  return <WindowActivityContext.Provider value={value}>{children}</WindowActivityContext.Provider>
}

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
  /** Trim chrome so full-bleed apps remain usable in short landscape views. */
  compact?: boolean
  /** Override context activity when a shell is used without a provider. */
  active?: boolean
  /** Override the context stacking layer when needed by a standalone caller. */
  layer?: number
  /** Called when the user interacts with the window surface. */
  onActivate?: () => void
  /** Use minimize affordances while retaining the existing onClose callback. */
  dismissAction?: "close" | "minimize"
  /** Games reserve Escape for pause; the title-bar close button stays available. */
  closeOnEscape?: boolean
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'

let bodyScrollLockCount = 0
let bodyOverflowBeforeLocks = ""

function acquireBodyScrollLock() {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLocks = document.body.style.overflow
    document.body.style.overflow = "hidden"
  }
  bodyScrollLockCount++
  return () => {
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = bodyOverflowBeforeLocks
    }
  }
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
  compact = false,
  active,
  layer,
  onActivate,
  dismissAction = "close",
  closeOnEscape = true,
}: WindowShellProps) {
  const activity = useContext(WindowActivityContext)
  const isActive = active ?? activity.active
  const shellLayer = layer ?? activity.layer
  const activate = onActivate ?? activity.onActivate
  const edgeInset = compact ? "0px" : "8px"
  const titlePadding = compact ? "0.25rem 0.5rem" : "0.75rem 1rem"
  const closeSize = compact ? "34px" : "44px"
  const windowRef = useRef<HTMLDivElement>(null)

  // Lock body scroll while window is open
  useEffect(() => {
    if (hidden) return
    return acquireBodyScrollLock()
  }, [hidden])

  // Handle ESC key
  useEffect(() => {
    if (hidden || !isActive || !closeOnEscape) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [hidden, isActive, closeOnEscape, onClose])

  // Move keyboard focus into the newly active dialog. Inactive windows remain
  // mounted, but only the top one participates in the modal focus contract.
  useEffect(() => {
    if (hidden || !isActive) return
    const frame = window.requestAnimationFrame(() => {
      const dialog = windowRef.current
      if (!dialog || dialog.contains(document.activeElement)) return
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      const focusTarget = first ?? dialog
      focusTarget.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hidden, isActive])

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !windowRef.current) return
    const focusable = Array.from(
      windowRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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
    } else {
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
      const nextIndex = currentIndex + (e.shiftKey ? -1 : 1)
      const next = focusable[nextIndex]
      // Browsers are inconsistent about advancing from parent chrome into an
      // iframe. Move focus explicitly so keyboard players can enter game apps.
      if (next?.tagName === "IFRAME") {
        e.preventDefault()
        next.focus()
      }
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
          zIndex: shellLayer,
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
          zIndex: shellLayer + 1,
          display: hidden ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
        aria-hidden={hidden || !isActive ? "true" : undefined}
      >
        <div
          ref={windowRef}
          onKeyDown={handleKeyDown}
          onPointerDownCapture={activate}
          role="dialog"
          aria-label={title}
          aria-modal={isActive && !hidden ? "true" : undefined}
          tabIndex={-1}
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
                zIndex: shellLayer + 2,
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
              aria-label={dismissAction === "minimize" ? `Minimize ${title}` : "Close window"}
              title={dismissAction === "minimize" ? `Minimize ${title}` : "Close window"}
            >
              {dismissAction === "minimize" ? (
                <Minus size={24} strokeWidth={2.5} />
              ) : (
                <X size={24} strokeWidth={2.5} />
              )}
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
