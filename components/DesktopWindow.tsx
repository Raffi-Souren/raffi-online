"use client"

import type React from "react"
import { useEffect } from "react"

interface DesktopWindowProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  width?: string
  height?: string
}

export function DesktopWindow({
  title,
  isOpen,
  onClose,
  children,
  width = "600px",
  height = "500px",
}: DesktopWindowProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="xp-window" style={{ width, height }}>
        <div className="xp-titlebar">
          <span>{title}</span>
          <button onClick={onClose}>×</button>
        </div>
        <div className="win-body">{children}</div>
      </div>
    </div>
  )
}
