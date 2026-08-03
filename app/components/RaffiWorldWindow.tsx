"use client"

import { useEffect, useState } from "react"

import WindowShell from "../../components/ui/WindowShell"

interface RaffiWorldWindowProps {
  /** False means minimized: the window hides but the game keeps running. */
  isOpen: boolean
  onClose: () => void
}

// Same-origin static build.
const WORLD_SRC = "/world/index.html"

// The world reads its own debug/audit switches from location.search, which the
// iframe would otherwise never see. Forwarding this fixed allowlist lets the
// game's existing tooling drive it through the shell; anything else on the
// portfolio URL is ignored, so a normal visit still loads a clean world.
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

/**
 * RAFFI WORLD in the XP shell.
 *
 * The parent mounts this only after the first launch (lazy load) and then keeps
 * it mounted for the rest of the session, flipping `isOpen` instead. That is
 * what lets a player close the window and come back to the same run: unmounting
 * would tear down the WebGL context, the audio graph and all game state.
 */
export default function RaffiWorldWindow({ isOpen, onClose }: RaffiWorldWindowProps) {
  // Resolved once per mount and then frozen. Recomputing it on every render
  // would hand the iframe a new src string and restart the world.
  const [src] = useState(resolveWorldSrc)

  // A short landscape phone has no height to spare: the world's own bottom HUD
  // runs out of room below roughly 280px of viewport, so the shell gives back
  // its inset and title-bar padding rather than clipping the game's controls.
  // Tailwind's breakpoints are width-based, so this is measured directly.
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
    >
      <iframe
        // No key, and src is frozen state: either changing would force a
        // remount and restart the world.
        src={src}
        title="RAFFI WORLD"
        allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
        style={{
          border: "none",
          display: "block",
          height: "100%",
          width: "100%",
        }}
      />
    </WindowShell>
  )
}
