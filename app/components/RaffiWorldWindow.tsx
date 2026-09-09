"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

import WindowShell, { useWindowActivity } from "../../components/ui/WindowShell"
import GameShelfNav from "./GameShelfNav"
import { useAudio } from "../context/AudioContext"

const CrateQuestGame = dynamic(() => import("./CrateQuestGame"), {
  ssr: false,
  loading: () => (
    <p role="status" style={{ padding: 24, color: "#e8debd" }}>
      Opening the record shop…
    </p>
  ),
})

interface RaffiWorldWindowProps {
  /** The iframe stays mounted when hidden so reopening preserves the run. */
  isOpen: boolean
  onClose: () => void
  /** Minimize the world and bring the Games shelf forward. */
  onOpenShelf?: () => void
  cheatRequest?: { id: number; code: string | null } | null
}

const WORLD_SRC = "/world/index.html"
const FORWARDED_WORLD_PARAMS = ["debug", "auto", "seed", "to", "grade", "district", "hour", "lowfi", "quality", "tier"]

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

export default function RaffiWorldWindow({ isOpen, onClose, onOpenShelf, cheatRequest }: RaffiWorldWindowProps) {
  // Resolve once: changing iframe src would restart the game.
  const [src] = useState(resolveWorldSrc)
  const [compact, setCompact] = useState(false)
  const [questOpen, setQuestOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const questRef = useRef<HTMLDivElement>(null)
  const { active } = useWindowActivity()
  const { isPlaying, pauseTrack } = useAudio()

  const syncWorldActivity = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "raffi-world:activity", active: isOpen && active },
      window.location.origin,
    )
  }, [isOpen, active])
  useEffect(syncWorldActivity, [syncWorldActivity])
  const syncCheatRequest = useCallback(() => {
    if (!cheatRequest || !isOpen) return
    iframeRef.current?.contentWindow?.postMessage(
      { type: "raffi-world:cheats", action: "open", requestId: cheatRequest.id, code: cheatRequest.code },
      window.location.origin,
    )
  }, [cheatRequest, isOpen])
  useEffect(syncCheatRequest, [syncCheatRequest])
  const syncHostAudio = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "raffi-world:host-audio", playing: isPlaying }, window.location.origin)
  }, [isPlaying])
  useEffect(syncHostAudio, [syncHostAudio])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return
      if (Object.keys(event.data).length !== 2) return
      if (event.data.type === "raffi-world:audio-focus" && event.data.action === "radio") pauseTrack()
      if (event.data.type === "raffi-world:crate-quest" && event.data.action === "open") setQuestOpen(true)
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [pauseTrack])

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
      closeOnEscape={false}
    >
      {onOpenShelf && (
        <GameShelfNav onBack={onOpenShelf} compact={compact}>
          <span style={{ fontSize: 11, color: "#5d6f7a", paddingRight: 4 }}>Your session stays open</span>
        </GameShelfNav>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={() => { syncWorldActivity(); syncCheatRequest(); syncHostAudio() }}
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
