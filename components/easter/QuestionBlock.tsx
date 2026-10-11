"use client"

import { useEffect, useRef, useState } from "react"
import { Disc3, Pause, Play } from "lucide-react"

interface QuestionBlockProps {
  onClick?: () => void
  active?: boolean
}

const BLOCK_SIZE = 56
// Let the block disappear just beyond an edge before bouncing back into view.
const EDGE_OVERSHOOT = BLOCK_SIZE + 16

export default function QuestionBlock({ onClick, active = true }: QuestionBlockProps) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLButtonElement>(null)
  const motionRef = useRef({ active, paused: false, focused: false, reduced: false, revealing: false, settled: false })
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [settled, setSettled] = useState(false)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [motionReady, setMotionReady] = useState(false)

  useEffect(() => {
    motionRef.current.active = active
  }, [active])

  useEffect(() => {
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
    let x = Math.max(0, width * 0.12)
    let y = Math.max(0, height * 0.55 - BLOCK_SIZE)
    let directionX = 1
    let directionY = -1
    let previous = 0
    let animation = 0
    const resize = new ResizeObserver(() => {
      width = field.clientWidth
      height = field.clientHeight
      x = Math.max(0, Math.min(x, width - BLOCK_SIZE))
      y = Math.max(0, Math.min(y, height - BLOCK_SIZE))
      block.style.transform = `translate3d(${x}px, ${y}px, 0)`
      setMotionReady(true)
    })
    resize.observe(field)

    const frame = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0
      previous = now
      const state = motionRef.current
      if (
        state.active &&
        !state.paused &&
        !state.focused &&
        !state.reduced &&
        !state.revealing &&
        !document.hidden
      ) {
        const speed = 64
        const min = -EDGE_OVERSHOOT
        const maxX = width - BLOCK_SIZE + EDGE_OVERSHOOT
        const maxY = height - BLOCK_SIZE + EDGE_OVERSHOOT
        x += directionX * speed * dt
        y += directionY * speed * 0.72 * dt
        if (x <= min || x >= maxX) {
          directionX *= -1
          x = Math.max(min, Math.min(maxX, x))
        }
        if (y <= min || y >= maxY) {
          directionY *= -1
          y = Math.max(min, Math.min(maxY, y))
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
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current)
    }
  }, [])

  const revealSurprise = () => {
    if (motionRef.current.revealing) return
    if (motionRef.current.settled) {
      onClick?.()
      return
    }
    motionRef.current.revealing = true
    motionRef.current.settled = true
    setSettled(true)
    setRevealing(true)
    rewardTimerRef.current = setTimeout(
      () => {
        motionRef.current.revealing = false
        motionRef.current.focused = false
        setRevealing(false)
        onClick?.()
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
      data-settled={settled}
      style={{
        position: "fixed",
        inset: "0 0 calc(44px + env(safe-area-inset-bottom, 0px))",
        zIndex: 20,
        pointerEvents: "none",
        visibility: active && motionReady ? "visible" : "hidden",
      }}
    >
      <button
        ref={blockRef}
        type="button"
        aria-label={settled ? "Play the secret level" : "Question block: unlock a secret level"}
        onClick={revealSurprise}
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
          className={revealing ? "surprise-block" : ""}
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
        {revealing && (
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
          aria-label={paused ? "Resume mystery box movement" : "Pause mystery box movement"}
          style={{
            position: "absolute",
            bottom: 8,
            left: "max(12px, env(safe-area-inset-left, 0px))",
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
          {paused ? "Resume movement" : "Pause movement"}
        </button>
      )}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          bottom: 45,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: "calc(100% - 32px)",
          width: "max-content",
          padding: revealing ? "12px 18px" : 0,
          border: revealing ? "2px solid #ffdf6f" : 0,
          borderRadius: 6,
          background: "#173453",
          color: "#fff7d4",
          fontFamily: "Tahoma, sans-serif",
          textAlign: "center",
          boxShadow: revealing ? "0 5px 0 #0004" : "none",
        }}
      >
        {revealing && (
          <>
            <strong style={{ display: "block", fontSize: 17 }}>Secret level unlocked</strong>
            <span style={{ fontSize: 12 }}>World 1-1 · Downtown Dig</span>
          </>
        )}
      </div>
      <style jsx>{`
        @keyframes surprise-block {
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
        .surprise-block {
          animation: surprise-block 650ms ease-out;
        }
        :global(.found-record) {
          animation: found-record 800ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .surprise-block,
          :global(.found-record) {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
