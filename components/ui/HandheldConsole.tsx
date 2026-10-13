"use client"

import { type ReactNode } from "react"
import GameJoystick from "./GameJoystick"
import GameControlChoice from "./GameControlChoice"
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
  controlMode?: "stick" | "buttons"
  onControlModeChange?: (mode: "stick" | "buttons") => void
  onStick?: (value: { x: number; y: number }) => void
  controlsDisabled?: boolean
}

const landscapeLayout = `
.hc-console { width: min(100%, 420px); }
.hc-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
@media (orientation: landscape) and (max-height: 540px) {
  .hc-console {
    width: auto;
    max-width: 100%;
    display: grid;
    grid-template-columns: auto auto auto;
    grid-template-areas: "choice screen actions" "pad screen actions";
    grid-template-rows: auto 1fr;
    align-items: center;
    column-gap: 14px;
    padding: 8px 14px !important;
    border-radius: 18px 18px 40px 18px !important;
  }
  .hc-console > header, .hc-speaker { display: none !important; }
  .hc-screen { grid-area: screen; }
  .hc-screen > * {
    width: auto !important;
    height: min(calc(100dvh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)), 400px);
    max-width: none !important;
  }
  .hc-choice { grid-area: choice; margin-top: 0 !important; }
  .hc-controls { display: contents; }
  .hc-pad { grid-area: pad; align-self: center; justify-self: center; }
  .hc-actions { grid-area: actions; flex-direction: column !important; }
}
`

export default function HandheldConsole({
  title,
  children,
  onDirection,
  onStart,
  onAction,
  paused,
  horizontalOnly = false,
  controlMode = "buttons",
  onControlModeChange,
  onStick,
  controlsDisabled = false,
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
      className="game-touch hc-console"
      style={{
        padding: "12px clamp(10px, 3vw, 22px) 14px",
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
          margin: "0 0 8px",
          fontFamily: "'Trebuchet MS', Arial, sans-serif",
        }}
      >
        <strong style={{ fontSize: 14, letterSpacing: -0.5 }}>raffi pocket</strong>
        <span style={{ fontSize: 10 }}>{title}</span>
      </header>
      <style>{landscapeLayout}</style>
      <div
        className="hc-screen"
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
      {onControlModeChange && (
        <div className="hc-choice" style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <GameControlChoice value={controlMode} onChange={onControlModeChange} />
        </div>
      )}
      <div className="hc-controls">
        {controlMode === "stick" && onStick ? (
          <div className="hc-pad">
          <GameJoystick
            label={`${title} movement stick`}
            axis={horizontalOnly ? "horizontal" : "both"}
            fourWay={!horizontalOnly}
            onChange={onStick}
            disabled={controlsDisabled}
            size={112}
          />
          </div>
        ) : (
          <div
            className="hc-pad"
            role="group"
            aria-label="Directional pad"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 44px)",
              gridTemplateRows: horizontalOnly ? "44px" : "repeat(3, 44px)",
              flexShrink: 0,
              touchAction: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{ gridRow: horizontalOnly ? 1 : 2, gridColumn: 2, background: "#424c48", boxShadow: "inset 0 0 4px #0005" }}
            />
            {directions
              .filter(({ direction }) => !horizontalOnly || direction === "LEFT" || direction === "RIGHT")
              .map(({ direction, icon: Icon, row, column }) => (
                <button
                  key={direction}
                  type="button"
                  aria-label={`Move ${direction.toLowerCase()}`}
                  disabled={controlsDisabled}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    onDirection(direction, true)
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId)
                    } catch {
                      /* A finger that already lifted still releases through pointerup. */
                    }
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
                    gridRow: horizontalOnly ? 1 : row,
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
        )}
        <div className="hc-actions" style={{ display: "flex", flexDirection: horizontalOnly ? "row" : "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onStart}
          aria-label={paused ? "Resume game" : "Start or pause game"}
          style={{
            border: "1px solid #8c988d",
            borderRadius: 20,
            padding: "7px 14px",
            background: "#aeb8ac",
            color: "#334835",
            fontSize: 10,
            fontWeight: 800,
            minHeight: 44,
            minWidth: 64,
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
      </div>
      <div className="hc-speaker" aria-hidden="true" style={{ display: "flex", gap: 5, justifyContent: "flex-end", margin: "8px 6px 0" }}>
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
