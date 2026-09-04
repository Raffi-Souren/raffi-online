"use client"

import { useEffect, useRef, useState } from "react"
import { Disc3, Pause, Play } from "lucide-react"

interface QuestionBlockProps {
  onClick?: (catchNumber: number) => void
  active?: boolean
}

const CATCH_STORAGE_KEY = "raffi-mystery-catches"
const BLOCK_SIZE = 56

function readCatchCount() {
  const saved = Number(localStorage.getItem(CATCH_STORAGE_KEY))
  return Number.isSafeInteger(saved) && saved > 0 ? saved : 0
}

export default function QuestionBlock({ onClick, active = true }: QuestionBlockProps) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLButtonElement>(null)
  const motionRef = useRef({ active, paused: false, focused: false, reduced: false, catching: false, catches: 0 })
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [catches, setCatches] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [caught, setCaught] = useState(false)

  useEffect(() => {
    motionRef.current.active = active
  }, [active])

  useEffect(() => {
    try {
      const saved = readCatchCount()
      setCatches(saved)
      motionRef.current.catches = saved
    } catch {
      /* The chase works without browser storage. */
    }

    const syncCatches = (event: StorageEvent) => {
      if (event.key !== CATCH_STORAGE_KEY) return
      try {
        const total = readCatchCount()
        motionRef.current.catches = total
        setCatches(total)
      } catch {
        /* Keep this session's score when storage is unavailable. */
      }
    }
    window.addEventListener("storage", syncCatches)

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncPreference = () => {
      motionRef.current.reduced = preference.matches
      setReducedMotion(preference.matches)
    }
    syncPreference()
    preference.addEventListener("change", syncPreference)

    const field = fieldRef.current
    const block = blockRef.current
    if (!field || !block) return
    let width = field.clientWidth
    let height = field.clientHeight
    let x = Math.min(14, Math.max(0, width - BLOCK_SIZE))
    let y = Math.max(0, height - BLOCK_SIZE - 46)
    let directionX = 1
    let directionY = -1
    let previous = 0
    let animation = 0
    const resize = new ResizeObserver(() => {
      width = field.clientWidth
      height = field.clientHeight
      x = Math.max(0, Math.min(x, width - BLOCK_SIZE))
      y = Math.max(0, Math.min(y, height - BLOCK_SIZE - 38))
      block.style.transform = `translate3d(${x}px, ${y}px, 0)`
    })
    resize.observe(field)

    const frame = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0
      previous = now
      const state = motionRef.current
      if (state.active && !state.paused && !state.focused && !state.reduced && !state.catching && !document.hidden) {
        const speed = 64 + Math.min(state.catches, 12) * 4
        const maxX = Math.max(0, width - BLOCK_SIZE)
        const maxY = Math.max(0, height - BLOCK_SIZE - 38)
        x += directionX * speed * dt
        y += directionY * speed * 0.72 * dt
        if (x <= 0 || x >= maxX) {
          directionX *= -1
          x = Math.max(0, Math.min(maxX, x))
        }
        if (y <= 0 || y >= maxY) {
          directionY *= -1
          y = Math.max(0, Math.min(maxY, y))
        }
      }
      block.style.transform = `translate3d(${x}px, ${y}px, 0)`
      animation = requestAnimationFrame(frame)
    }
    animation = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animation)
      resize.disconnect()
      preference.removeEventListener("change", syncPreference)
      window.removeEventListener("storage", syncCatches)
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current)
    }
  }, [])

  const catchBlock = () => {
    if (motionRef.current.catching) return
    motionRef.current.catching = true
    let previous = motionRef.current.catches
    try {
      previous = Math.max(previous, readCatchCount())
    } catch {
      /* Keep counting in memory. */
    }
    const total = previous + 1
    motionRef.current.catches = total
    setCatches(total)
    setCaught(true)
    try {
      localStorage.setItem(CATCH_STORAGE_KEY, String(total))
    } catch {
      /* Optional personal score. */
    }
    rewardTimerRef.current = setTimeout(
      () => {
        motionRef.current.catching = false
        motionRef.current.focused = false
        setCaught(false)
        onClick?.(total)
      },
      motionRef.current.reduced ? 250 : 800,
    )
  }

  const toggleMotion = () => {
    const next = !motionRef.current.paused
    motionRef.current.paused = next
    setPaused(next)
  }

  return (
    <div
      ref={fieldRef}
      data-mystery-chase="true"
      style={{
        position: "fixed",
        inset:
          "max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) calc(54px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px))",
        zIndex: 20,
        pointerEvents: "none",
        visibility: active ? "visible" : "hidden",
      }}
    >
      <button
        ref={blockRef}
        type="button"
        aria-label={`Catch the mystery box. ${catches} ${catches === 1 ? "catch" : "catches"}. Opens the music crate.`}
        title="Catch me for a surprise track. One click = one catch."
        onClick={catchBlock}
        onFocus={() => {
          motionRef.current.focused = true
        }}
        onBlur={() => {
          motionRef.current.focused = false
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BLOCK_SIZE,
          height: BLOCK_SIZE,
          border: 0,
          padding: 0,
          background: "transparent",
          pointerEvents: active ? "auto" : "none",
          cursor: "pointer",
          touchAction: "manipulation",
          willChange: "transform",
          borderRadius: 5,
        }}
        className="focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <span
          className={caught ? "caught-block" : ""}
          style={{ display: "block", width: "100%", height: "100%", filter: "drop-shadow(0 4px 3px #0006)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/question-block.png"
            alt=""
            draggable={false}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </span>
        {catches > 0 && (
          <span
            style={{
              position: "absolute",
              right: -6,
              bottom: -3,
              borderRadius: 10,
              background: "#163b71",
              color: "#fff",
              border: "2px solid #fff6c1",
              fontSize: 11,
              fontWeight: 800,
              padding: "1px 5px",
            }}
          >
            ×{catches}
          </span>
        )}
        {caught && (
          <Disc3
            className="found-record"
            size={38}
            style={{ position: "absolute", top: -12, left: 9, color: "#ffe878", fill: "#243549" }}
          />
        )}
      </button>
      {!reducedMotion && (
        <button
          type="button"
          onClick={toggleMotion}
          aria-pressed={paused}
          aria-label={paused ? "Resume mystery box chase" : "Pause mystery box chase"}
          style={{
            position: "absolute",
            bottom: 0,
            left: 4,
            display: "inline-flex",
            gap: 5,
            alignItems: "center",
            minHeight: 32,
            padding: "4px 8px",
            border: "1px solid #ffffff65",
            borderRadius: 4,
            background: "#173e6199",
            color: "white",
            fontFamily: "Tahoma, sans-serif",
            fontSize: 10,
            pointerEvents: active ? "auto" : "none",
          }}
          className="hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume chase" : "Pause chase"}
        </button>
      )}
      <span
        style={{
          position: "absolute",
          bottom: 7,
          left: reducedMotion ? 4 : 112,
          color: "white",
          fontFamily: "Tahoma, sans-serif",
          fontSize: 11,
          textShadow: "0 1px 3px #000",
        }}
      >
        {catches} {catches === 1 ? "catch" : "catches"} · Catch ? for a track
      </span>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          bottom: 45,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: "calc(100% - 20px)",
          width: "max-content",
          padding: caught ? "12px 18px" : 0,
          border: caught ? "2px solid #ffdf6f" : 0,
          borderRadius: 6,
          background: "#173453",
          color: "#fff7d4",
          fontFamily: "Tahoma, sans-serif",
          textAlign: "center",
          boxShadow: caught ? "0 5px 0 #0004" : "none",
        }}
      >
        {caught && (
          <>
            <strong style={{ display: "block", fontSize: 17 }}>Catch #{catches}</strong>
            <span style={{ fontSize: 12 }}>Nice catch. Here comes your surprise track…</span>
          </>
        )}
      </div>
      <style jsx>{`
        @keyframes caught-block {
          35% {
            transform: translateY(-14px) rotate(-8deg) scale(1.16);
          }
          70% {
            transform: rotate(6deg);
          }
        }
        @keyframes found-record {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
          100% {
            transform: translateY(-55px) rotate(140deg);
            opacity: 0;
          }
        }
        .caught-block {
          animation: caught-block 650ms ease-out;
        }
        :global(.found-record) {
          animation: found-record 800ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .caught-block,
          :global(.found-record) {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
