"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

import WindowShell, { useWindowActivity } from "../../components/ui/WindowShell"

const CrateQuestGame = dynamic(() => import("./CrateQuestGame"), {
  ssr: false,
  loading: () => (
    <p role="status" style={{ padding: 24, color: "#e8debd" }}>
      Opening the record shop…
    </p>
  ),
})

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
  const [questOpen, setQuestOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const questRef = useRef<HTMLDivElement>(null)
  const { active } = useWindowActivity()

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return
      if (Object.keys(event.data).length !== 2) return
      if (event.data.type === "raffi-world:crate-quest" && event.data.action === "open") setQuestOpen(true)
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [])

  useEffect(() => {
    if (!questOpen || !isOpen || !active) return
    const frame = requestAnimationFrame(() => questRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [questOpen, isOpen, active])

  const returnToWorld = useCallback((action: "complete" | "exit") => {
    iframeRef.current?.contentWindow?.postMessage({ type: "raffi-world:crate-quest", action }, window.location.origin)
    setQuestOpen(false)
    requestAnimationFrame(() => iframeRef.current?.focus({ preventScroll: true }))
  }, [])

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
      closeOnEscape={!questOpen}
    >
      <iframe
        ref={iframeRef}
        src={src}
        title="RAFFI WORLD"
        tabIndex={questOpen ? -1 : 0}
        aria-hidden={questOpen ? "true" : undefined}
        allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope"
        style={{
          border: "none",
          display: "block",
          visibility: questOpen ? "hidden" : "visible",
          pointerEvents: questOpen ? "none" : "auto",
          flex: "1 1 auto",
          height: "100%",
          minHeight: 0,
          width: "100%",
        }}
      />
      {questOpen && (
        <div
          ref={questRef}
          tabIndex={-1}
          role="region"
          aria-label="Crate Quest — record shop mission"
          style={{
            position: "absolute",
            inset: 0,
            background: "#182d31",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          <CrateQuestGame
            active={isOpen && active}
            onComplete={() => returnToWorld("complete")}
            onExit={() => returnToWorld("exit")}
          />
        </div>
      )}
    </WindowShell>
  )
}
