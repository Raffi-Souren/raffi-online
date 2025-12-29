"use client"

import WindowShell from "../../components/ui/WindowShell"
import IPodPlayer from "./IPodPlayer"

interface IPodWindowProps {
  isOpen: boolean
  onClose: () => void
}

export default function IPodWindow({ isOpen, onClose }: IPodWindowProps) {
  if (!isOpen) return null

  return (
    <WindowShell title="iPod" onClose={onClose}>
      <div className="flex items-center justify-center p-4" style={{ backgroundColor: "#1a1a2e", minHeight: "520px" }}>
        <IPodPlayer />
      </div>
    </WindowShell>
  )
}
