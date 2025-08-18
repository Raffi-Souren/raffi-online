"use client"

import type { ReactNode } from "react"
import { WindowsIcons } from "./Icons"

interface BaseWindowProps {
  title: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  isYellow?: boolean
}

export default function BaseWindow({ title, icon, onClose, children, isYellow = false }: BaseWindowProps) {
  return (
    <div
      className={`
        fixed
        inset-2
        md:inset-4
        z-50
        ${isYellow ? "yellow-window" : "window"}
      `}
    >
      <div className="window-title text-xs md:text-sm">
        <span className="flex items-center gap-1">
          {icon} {title}
        </span>
        <button className="ml-auto hover:bg-red-600 px-2 py-1 rounded" onClick={onClose}>
          {WindowsIcons.Close}
        </button>
      </div>
      <div className="window-content text-sm md:text-base">{children}</div>
    </div>
  )
}
