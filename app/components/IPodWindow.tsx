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
      <div
        style={{
          background: "radial-gradient(ellipse at 50% 35%, #c3cbbb, #9ca99a)",
          display: "flex",
          height:
            "min(540px, max(120px, calc(100dvh - 156px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))))",
          minHeight: 0,
          padding: "clamp(6px, 2vw, 20px)",
          width: "100%",
        }}
      >
        <IPodPlayer />
      </div>
    </WindowShell>
  )
}
