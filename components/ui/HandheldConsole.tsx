"use client"

import { type ReactNode } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"

export type PadDirection = "UP" | "DOWN" | "LEFT" | "RIGHT"

interface HandheldConsoleProps {
  title: string
  children: ReactNode
  onDirection: (direction: PadDirection, held: boolean) => void
  onStart: () => void
  onAction?: () => void
  paused: boolean
  horizontalOnly?: boolean
}

export default function HandheldConsole({
  title,
  children,
  onDirection,
  onStart,
  onAction,
  paused,
  horizontalOnly = false,
}: HandheldConsoleProps) {
  const directions = [
    { direction: "UP" as const, icon: ArrowUp, row: 1, column: 2 },
    { direction: "LEFT" as const, icon: ArrowLeft, row: 2, column: 1 },
    { direction: "RIGHT" as const, icon: ArrowRight, row: 2, column: 3 },
    { direction: "DOWN" as const, icon: ArrowDown, row: 3, column: 2 },
  ]
  return (
    <section
      aria-label={`${title} handheld console`}
      style={{
        width: "min(100%, 360px)",
        padding: "18px clamp(10px, 3vw, 22px) 20px",
        border: "1px solid #adb3aa",
        borderRadius: "18px 18px 52px 18px",
        background: "linear-gradient(120deg, #f0f0e6, #d8dacf 78%, #bcc3ba)",
        boxShadow: "inset 3px 3px 1px #fff, inset -4px -4px 2px #b4bcb2, 0 7px 0 #89948c, 0 12px 18px #18292225",
        color: "#364938",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "0 0 12px",
          fontFamily: "'Trebuchet MS', Arial, sans-serif",
        }}
      >
        <strong style={{ fontSize: 14, letterSpacing: -0.5 }}>raffi pocket</strong>
        <span style={{ fontSize: 10 }}>{title}</span>
      </header>
      <div
        style={{
          position: "relative",
          border: "7px solid #626d67",
          borderRadius: "7px 7px 18px 7px",
          boxShadow: "inset 0 2px 5px #0005, 0 1px 0 #fff",
          background: "#9bbb58",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 20 }}>
        <div
          role="group"
          aria-label="Directional pad"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 34px)",
            gridTemplateRows: "repeat(3, 34px)",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{ gridRow: 2, gridColumn: 2, background: "#424c48", boxShadow: "inset 0 0 4px #0005" }}
          />
          {directions
            .filter(({ direction }) => !horizontalOnly || direction === "LEFT" || direction === "RIGHT")
            .map(({ direction, icon: Icon, row, column }) => (
              <button
                key={direction}
                type="button"
                aria-label={`Move ${direction.toLowerCase()}`}
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  onDirection(direction, true)
                }}
                onPointerUp={() => onDirection(direction, false)}
                onPointerCancel={() => onDirection(direction, false)}
                onLostPointerCapture={() => onDirection(direction, false)}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault()
                    onDirection(direction, true)
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") onDirection(direction, false)
                }}
                onBlur={() => onDirection(direction, false)}
                style={{
                  gridRow: row,
                  gridColumn: column,
                  display: "grid",
                  placeItems: "center",
                  border: 0,
                  padding: 0,
                  background: "#424c48",
                  color: "#d8dfd4",
                  boxShadow: "0 3px 0 #27332d, inset 1px 1px 0 #ffffff35",
                  borderRadius: 3,
                  touchAction: "none",
                }}
                className="active:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800"
              >
                <Icon size={18} />
              </button>
            ))}
        </div>
        <button
          type="button"
          onClick={onStart}
          aria-label={paused ? "Resume game" : "Start or pause game"}
          style={{
            border: "1px solid #8c988d",
            borderRadius: 20,
            padding: "7px 12px",
            background: "#aeb8ac",
            color: "#334835",
            fontSize: 10,
            fontWeight: 800,
            minHeight: 34,
            boxShadow: "0 3px 0 #83917f, inset 1px 1px 0 #e3e7de",
            transform: "rotate(-12deg)",
          }}
          className="active:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800"
        >
          {paused ? "RESUME" : "START"}
        </button>
        <button
          type="button"
          onClick={onAction ?? onStart}
          aria-label={onAction ? "Action" : "Start or pause game"}
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            border: "2px solid #754054",
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 28%, #bc708e, #8a4767 75%)",
            color: "#f6dce7",
            fontWeight: 800,
            fontSize: 17,
            boxShadow: "0 5px 0 #63374b, inset 1px 1px 2px #ffffff50",
          }}
          className="active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800"
        >
          A
        </button>
      </div>
      <div aria-hidden="true" style={{ display: "flex", gap: 5, justifyContent: "flex-end", margin: "12px 6px 0" }}>
        {[0, 1, 2, 3, 4].map((slot) => (
          <span
            key={slot}
            style={{
              width: 4,
              height: 22,
              borderRadius: 3,
              background: "#97a492",
              boxShadow: "inset 1px 1px 1px #6f806a",
              transform: "rotate(-28deg)",
            }}
          />
        ))}
      </div>
    </section>
  )
}
