"use client"

import { useEffect, useState } from "react"

import WindowShell from "../../components/ui/WindowShell"

interface RaffiWorldWindowProps {
  /** False means minimized: the iframe stays mounted and can be restored. */
  isOpen: boolean
  /** Retained for API compatibility; the World shell presents this as minimize. */
  onClose: () => void
}

const WORLD_SRC = "/world/index.html"
const FORWARDED_WORLD_PARAMS = ["debug", "auto", "seed", "to", "grade", "district", "hour", "lowfi"]

function resolveWorldSrc() {
  if (typeof window === "undefined") return WORLD_SRC
  const incoming = new URLSearchParams(window.location.search)
  const forwarded = new URLSearchParams()
  for (const key of FORWARDED_WORLD_PARAMS) {
    const value = incoming.get(key)
    if (value !== null) forwarded.set(key, value)
  }
  const query = forwarded.toString()
  return query ? `${WORLD_SRC}?${query}` : WORLD_SRC
}

export default function RaffiWorldWindow({ isOpen, onClose }: RaffiWorldWindowProps) {
  // Resolve once: changing iframe src would restart the game.
  const [src] = useState(resolveWorldSrc)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const shortViewport = window.matchMedia("(max-height: 520px)")
    const sync = () => setCompact(shortViewport.matches)
    sync()
    shortViewport.addEventListener("change", sync)
    return () => shortViewport.removeEventListener("change", sync)
  }, [])

  return (
    <WindowShell
      title="RAFFI WORLD"
      onClose={onClose}
      hidden={!isOpen}
      fullBleed
      fill
      compact={compact}
      maxWidth="min(1400px, 100%)"
      dismissAction="minimize"
    >
      <iframe
        src={src}
        title="RAFFI WORLD"
        tabIndex={0}
        allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
        style={{
          border: "none",
          display: "block",
          flex: "1 1 auto",
          height: "100%",
          minHeight: 0,
          width: "100%",
        }}
      />
    </WindowShell>
  )
}
