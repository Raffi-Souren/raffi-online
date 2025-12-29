"use client"

import { useState, useEffect, useCallback } from "react"

interface ContextMenuItem {
  label: string
  action: () => void
  divider?: boolean
  disabled?: boolean
}

interface DesktopContextMenuProps {
  onOpenWindow: (windowName: string) => void
}

export default function DesktopContextMenu({ onOpenWindow }: DesktopContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleContextMenu = useCallback((e: MouseEvent) => {
    // Only show context menu if clicking on the desktop background
    const target = e.target as HTMLElement
    const isDesktopBackground =
      target.tagName === "IMG" ||
      target.closest('[data-desktop-bg="true"]') ||
      (target.classList.contains("min-h-screen") && !target.closest("button") && !target.closest('[role="dialog"]'))

    if (isDesktopBackground) {
      e.preventDefault()
      setPosition({ x: e.clientX, y: e.clientY })
      setIsOpen(true)
    }
  }, [])

  const handleClick = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("click", handleClick)
    }
  }, [handleContextMenu, handleClick])

  const menuItems: ContextMenuItem[] = [
    { label: "View", action: () => {}, disabled: true },
    { label: "Sort by", action: () => {}, disabled: true },
    { label: "Refresh", action: () => window.location.reload(), divider: true },
    { label: "New Folder", action: () => {}, disabled: true, divider: true },
    { label: "About", action: () => onOpenWindow("about") },
    { label: "Games", action: () => onOpenWindow("games") },
    { label: "iPod", action: () => onOpenWindow("ipod") },
    { label: "Notes", action: () => onOpenWindow("notes"), divider: true },
    { label: "Properties", action: () => onOpenWindow("about"), disabled: false },
  ]

  if (!isOpen) return null

  // Adjust position to keep menu on screen
  const menuWidth = 180
  const menuHeight = menuItems.length * 28 + 16
  const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - 10)
  const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - 10)

  return (
    <div
      style={{
        position: "fixed",
        top: adjustedY,
        left: adjustedX,
        zIndex: 1000,
        minWidth: `${menuWidth}px`,
        background: "linear-gradient(180deg, #fff 0%, #f0f0f0 100%)",
        border: "1px solid #808080",
        boxShadow: "2px 2px 8px rgba(0,0,0,0.3)",
        padding: "2px",
        fontFamily: "Tahoma, system-ui, sans-serif",
        fontSize: "12px",
      }}
    >
      {menuItems.map((item, index) => (
        <div key={index}>
          <button
            onClick={() => {
              if (!item.disabled) {
                item.action()
                setIsOpen(false)
              }
            }}
            disabled={item.disabled}
            style={{
              width: "100%",
              padding: "4px 24px 4px 24px",
              textAlign: "left",
              background: "transparent",
              border: "none",
              cursor: item.disabled ? "default" : "pointer",
              color: item.disabled ? "#808080" : "#000",
              display: "block",
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background = "#0a246a"
                e.currentTarget.style.color = "#fff"
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = item.disabled ? "#808080" : "#000"
            }}
          >
            {item.label}
          </button>
          {item.divider && (
            <hr
              style={{
                margin: "2px 2px",
                border: "none",
                borderTop: "1px solid #808080",
                borderBottom: "1px solid #fff",
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
