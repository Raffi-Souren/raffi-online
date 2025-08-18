"use client"

import type { ReactNode } from "react"
import WindowShell from "../app/components/WindowShell"

type Props = {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  isYellow?: boolean
}

export default function DesktopWindow({ title, isOpen, onClose, children, className, isYellow = false }: Props) {
  if (!isOpen) return null

  return (
    <WindowShell
      title={title}
      onClose={onClose}
      className={`
        ${isYellow ? "bg-black border-2 border-[#ffd700]" : "bg-[#c0c0c0] border-2 border-[#c0c0c0]"}
        ${className || ""}
      `}
    >
      <div
        className={`
          p-3 md:p-4
          ${isYellow ? "bg-black text-[#ffd700]" : "bg-[#c0c0c0] text-black"}
        `}
      >
        {children}
      </div>
    </WindowShell>
  )
}
