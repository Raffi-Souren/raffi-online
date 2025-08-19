"use client"

import type React from "react"

interface DesktopIconProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

export function DesktopIcon({ icon, label, onClick }: DesktopIconProps) {
  return (
    <div className="desktop-icon" onClick={onClick}>
      <div className="desktop-icon-image">{icon}</div>
      <div className="desktop-label">{label}</div>
    </div>
  )
}
