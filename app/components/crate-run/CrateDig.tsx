"use client"

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { SOUNDCLOUD_TRACKS, type Track } from "@/data/audio-library"
import { crateSizeFor } from "@/lib/crate-run-engine"
import { PALETTE } from "./draw"

interface CrateDigProps {
  records: number
  onPull: (track: Track) => void
}

const SLEEVE_COLORS = [PALETTE.brick, PALETTE.navy, PALETTE.amber, PALETTE.cream] as const

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pickCrate(size: number) {
  const pool = [...SOUNDCLOUD_TRACKS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(size, pool.length))
}

function Sleeve({ track }: { track: Track }) {
  const seed = hash(track.id)
  const background = SLEEVE_COLORS[seed % SLEEVE_COLORS.length]
  const ink = background === PALETTE.navy || background === PALETTE.brick ? PALETTE.cream : PALETTE.ink
  const initial = (track.artist || track.title).trim().charAt(0).toUpperCase()
  const stripe = SLEEVE_COLORS[(seed + 1) % SLEEVE_COLORS.length]
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "6%",
          right: "-4%",
          width: "88%",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${PALETTE.amber} 0 16%, ${PALETTE.ink} 17% 100%)`,
          boxShadow: `inset 0 0 0 6px ${PALETTE.ink}, inset 0 0 0 7px #ffffff14, inset 0 0 0 18px ${PALETTE.ink}, inset 0 0 0 19px #ffffff12`,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "88%",
          height: "100%",
          borderRadius: 4,
          border: `2px solid ${PALETTE.ink}`,
          background,
          color: ink,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 12,
          boxShadow: `6px 6px 0 ${PALETTE.ink}`,
        }}
      >
        <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: `${30 + (seed % 30)}%`, height: 14, background: stripe, opacity: 0.85 }} />
        <span aria-hidden="true" style={{ position: "relative", fontSize: 72, lineHeight: 0.9, fontWeight: 900, letterSpacing: "-0.04em" }}>
          {initial}
        </span>
        <span style={{ position: "relative", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: "0.12em" }}>
          RAF&apos;S CRATE
        </span>
      </div>
    </div>
  )
}

export default function CrateDig({ records, onPull }: CrateDigProps) {
  const [crate] = useState(() => pickCrate(crateSizeFor(records)))
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const dragRef = useRef<{ x: number; id: number } | null>(null)
  const track = crate[index]

  const flip = (step: 1 | -1) => {
    setDirection(step)
    setIndex((current) => (current + step + crate.length) % crate.length)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      flip(-1)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      flip(1)
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, id: event.pointerId }
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.id !== event.pointerId) return
    const delta = event.clientX - drag.x
    if (Math.abs(delta) > 36) flip(delta < 0 ? 1 : -1)
  }

  if (!track) return null

  const navButton = (step: 1 | -1) => (
    <button
      type="button"
      onClick={() => flip(step)}
      aria-label={step < 0 ? "Previous record" : "Next record"}
      className="hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 48,
        borderRadius: 24,
        border: `2px solid ${PALETTE.cream}`,
        background: "transparent",
        color: PALETTE.cream,
        cursor: "pointer",
        outlineColor: PALETTE.amber,
      }}
    >
      {step < 0 ? <ChevronLeft size={24} aria-hidden="true" /> : <ChevronRight size={24} aria-hidden="true" />}
    </button>
  )

  return (
    <div
      className="game-touch"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "18px 16px 20px", background: PALETTE.ink, color: PALETTE.cream }}
    >
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: "0.2em", color: PALETTE.amber }}>
          RAF&apos;S RECORDS · BACK ROOM
        </p>
        <h2 className="text-balance" style={{ margin: 0, fontSize: 22, lineHeight: 1.15, fontWeight: 800 }}>
          Dig the crate
        </h2>
        <p className="text-pretty" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.8 }}>
          {records > 0
            ? `You picked up ${records} record${records === 1 ? "" : "s"} on the way, so this crate runs ${crate.length} deep.`
            : `Straight to the shop. The crate runs ${crate.length} deep.`}{" "}
          Swipe to flip, then pull one.
        </p>
      </div>

      <div
        role="group"
        aria-roledescription="record crate"
        aria-label={`Record ${index + 1} of ${crate.length}: ${track.title} by ${track.artist}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragRef.current = null)}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        style={{ width: "min(72vw, 240px)", touchAction: "pan-y", cursor: "grab", outlineColor: PALETTE.amber }}
      >
        <div key={track.id} className={direction > 0 ? "sleeve-next" : "sleeve-prev"}>
          <Sleeve track={track} />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            marginTop: -18,
            height: 52,
            borderRadius: "0 0 6px 6px",
            border: `2px solid ${PALETTE.ink}`,
            background: `repeating-linear-gradient(180deg, ${PALETTE.brickDark} 0 14px, ${PALETTE.brick} 14px 17px)`,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 3,
            paddingTop: 4,
          }}
        >
          {crate.map((item, spine) => (
            <span
              key={item.id}
              style={{ width: 4, height: spine === index ? 14 : 9, borderRadius: 1, background: spine === index ? PALETTE.amber : PALETTE.cream, opacity: spine === index ? 1 : 0.55 }}
            />
          ))}
        </div>
      </div>

      <div aria-live="polite" style={{ textAlign: "center", minHeight: 48 }}>
        <p className="text-balance" style={{ margin: 0, fontSize: 17, lineHeight: 1.3, fontWeight: 700 }}>
          {track.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 14, opacity: 0.75 }}>{track.artist}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {navButton(-1)}
        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, minWidth: 44, textAlign: "center" }}>
          {index + 1} / {crate.length}
        </span>
        {navButton(1)}
      </div>

      <button
        type="button"
        onClick={() => onPull(track)}
        className="hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          width: "100%",
          minHeight: 52,
          border: `2px solid ${PALETTE.ink}`,
          borderRadius: 10,
          background: PALETTE.amber,
          color: PALETTE.ink,
          fontWeight: 800,
          fontSize: 16,
          cursor: "pointer",
          boxShadow: `0 4px 0 ${PALETTE.brickDark}`,
          outlineColor: PALETTE.cream,
        }}
      >
        Pull this record and play it
      </button>

      <style jsx>{`
        @keyframes sleeve-next {
          from {
            transform: translateX(24px) rotate(2deg);
            opacity: 0;
          }
        }
        @keyframes sleeve-prev {
          from {
            transform: translateX(-24px) rotate(-2deg);
            opacity: 0;
          }
        }
        .sleeve-next {
          animation: sleeve-next 220ms ease-out;
        }
        .sleeve-prev {
          animation: sleeve-prev 220ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .sleeve-next,
          .sleeve-prev {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
