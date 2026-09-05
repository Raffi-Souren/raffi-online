"use client"

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Maximize2, Minimize2, Minus, X } from "lucide-react"

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
export function WindowActivityProvider({ active, layer, onActivate, children }: WindowActivityProviderProps) {
  const value = useMemo(() => ({ active, layer, onActivate }), [active, layer, onActivate])
  return <WindowActivityContext.Provider value={value}>{children}</WindowActivityContext.Provider>
}

interface WindowShellProps {
  title: string
  onClose: () => void
  /** Offer a separate minimize action alongside the existing close button. */
  onMinimize?: () => void
  /** Terminal apps can opt into dark chrome without changing the XP desktop. */
  appearance?: "xp" | "terminal"
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
  'button, [href], input, select, textarea, iframe, details > summary:first-of-type, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const editable = element.isContentEditable && !element.hasAttribute("tabindex")
    if ((element.tabIndex < 0 && !editable) || element.matches(":disabled, input[type='hidden']")) return false
    if (element.closest("[hidden], [inert]") || element.getClientRects().length === 0) return false
    const visibility = window.getComputedStyle(element).visibility
    return visibility !== "hidden" && visibility !== "collapse"
  })
}

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
  onMinimize,
  appearance = "xp",
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
  const [maximized, setMaximized] = useState(false)
  const terminalChrome = appearance === "terminal"
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
      const first = getFocusableElements(dialog)[0]
      const focusTarget = first ?? dialog
      focusTarget.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hidden, isActive])

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented || hidden || !isActive || !windowRef.current) return
      const focusable = getFocusableElements(windowRef.current)
      if (focusable.length === 0) {
        e.preventDefault()
        windowRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
      if (currentIndex === -1 && document.activeElement === windowRef.current) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else {
        const nextIndex = currentIndex + (e.shiftKey ? -1 : 1)
        const next = focusable[nextIndex]
        // Browsers are inconsistent about advancing from parent chrome into an
        // iframe. Move focus explicitly so keyboard players can enter game apps.
        if (next?.tagName === "IFRAME") {
          e.preventDefault()
          next.focus()
        }
      }
    },
    [hidden, isActive],
  )

  const windowActions = [
    ...(!terminalChrome && onMinimize
      ? [{ key: "minimize", label: `Minimize ${title}`, action: onMinimize, minimize: true }]
      : []),
    {
      key: "dismiss",
      label: dismissAction === "minimize" ? `Minimize ${title}` : "Close window",
      action: onClose,
      minimize: dismissAction === "minimize",
    },
    ...(terminalChrome && onMinimize
      ? [{ key: "minimize", label: `Minimize ${title}`, action: onMinimize, minimize: true }]
      : []),
    ...(terminalChrome
      ? [
          {
            key: "maximize",
            label: maximized ? "Restore window" : "Maximize window",
            action: () => setMaximized((previous) => !previous),
            minimize: false,
          },
        ]
      : []),
  ]

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
            borderRadius: terminalChrome ? "10px" : "0.5rem",
            border: terminalChrome ? "1px solid #34433a" : undefined,
            boxShadow: terminalChrome ? "0 24px 80px rgba(0, 0, 0, 0.55)" : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: terminalChrome && maximized ? "100%" : maxWidth,
            // A definite height is what lets `height: 100%` resolve further
            // down. Without it the dialog sizes to content and every nested
            // percentage height silently collapses to auto.
            height: fill || (terminalChrome && maximized) ? "100%" : undefined,
            maxHeight: "100%",
            pointerEvents: "auto",
            overflow: "hidden",
          }}
        >
          {/* App chrome stays reachable while the content scrolls. */}
          <div
            style={{
              background: terminalChrome ? "#151b18" : "linear-gradient(to right, #2563eb, #1d4ed8)",
              color: terminalChrome ? "#a2b5a7" : "white",
              padding: terminalChrome ? "0 10px" : titlePadding,
              minHeight: terminalChrome ? "42px" : undefined,
              borderBottom: terminalChrome ? "1px solid #34433a" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: terminalChrome ? "center" : "space-between",
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
                fontSize: terminalChrome ? "12px" : "1rem",
                fontFamily: terminalChrome ? '"SFMono-Regular", Consolas, monospace' : undefined,
                textAlign: terminalChrome ? "center" : undefined,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                padding: terminalChrome ? "0 94px" : "0 0.5rem 0 0",
                width: terminalChrome ? "100%" : undefined,
                margin: 0,
              }}
            >
              {title}
            </h2>
            <div
              style={{
                display: "flex",
                gap: terminalChrome ? "0px" : "4px",
                flexShrink: 0,
                position: terminalChrome ? "absolute" : undefined,
                left: terminalChrome ? "6px" : undefined,
              }}
            >
              {windowActions.map((action) =>
                terminalChrome ? (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.action}
                    aria-label={action.label}
                    title={action.label}
                    className="group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a1e7a8]"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 34,
                      padding: 0,
                      border: 0,
                      borderRadius: 5,
                      background: "transparent",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#142017",
                        background: action.key === "dismiss" ? "#ff6058" : action.minimize ? "#ffbd2e" : "#28c840",
                        border: "1px solid rgba(0, 0, 0, 0.15)",
                      }}
                    >
                      <span
                        className="opacity-0 group-hover:opacity-80 group-focus-visible:opacity-80"
                        aria-hidden="true"
                      >
                        {action.key === "maximize" ? (
                          maximized ? (
                            <Minimize2 size={10} strokeWidth={2.5} />
                          ) : (
                            <Maximize2 size={10} strokeWidth={2.5} />
                          )
                        ) : action.minimize ? (
                          <Minus size={10} strokeWidth={2.5} />
                        ) : (
                          <X size={10} strokeWidth={2.5} />
                        )}
                      </span>
                    </span>
                  </button>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.action}
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
                    aria-label={action.label}
                    title={action.label}
                  >
                    {action.minimize ? <Minus size={24} strokeWidth={2.5} /> : <X size={24} strokeWidth={2.5} />}
                  </button>
                ),
              )}
            </div>
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
