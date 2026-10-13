"use client"

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
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
  /** Screen width ÷ height. With it the console sizes its screen to the window instead of overflowing it. */
  screenAspect?: number
  /** Height a bar shown only during play will take above the console, kept free so starting does not resize it. */
  reserveHeight?: number
}

type Space = { width: number; height: number; viewport: number }
type Layout = { kind: "stacked" | "side"; screen: number; stick: number; grille: boolean }

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

// Console chrome in CSS pixels. The screen gets whatever is left.
const BORDER = 2
const HEADER = 28 // 20px label row and an 8px gap
const BEZEL = 14 // 7px screen border on each side
const GAP = 8
const BUTTON = 44 // smallest comfortable touch target
const PAD = 3 * BUTTON
const GRILLE = 30
const SIDE_GAP = 10
const START_COLUMN = 76
const SCREEN_MAX = 400
const SCREEN_MIN_HEIGHT = 180

/** Room the console can take: the window's height limit minus everything around the console. */
function measureSpace(section: HTMLElement): Space | null {
  const root = section.parentElement
  const dialog = section.closest<HTMLElement>('[role="dialog"]')
  const frame = dialog?.parentElement
  if (!root || !dialog || !frame) return null
  let scroller = root.parentElement
  while (scroller && scroller !== dialog && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
    scroller = scroller.parentElement
  }
  if (!scroller || scroller === dialog) return null
  const box = section.getBoundingClientRect()
  const area = scroller.getBoundingClientRect()
  const above = box.top - area.top + scroller.scrollTop
  const below = root.getBoundingClientRect().bottom - box.bottom + parseFloat(getComputedStyle(scroller).paddingBottom || "0")
  const titleBar = dialog.offsetHeight - scroller.offsetHeight
  const rootStyle = getComputedStyle(root)
  return {
    width: Math.floor(root.clientWidth - parseFloat(rootStyle.paddingLeft) - parseFloat(rootStyle.paddingRight)),
    height: Math.floor(frame.clientHeight - titleBar - above - below),
    viewport: window.innerWidth,
  }
}

/** Picks the console shape that gives the screen the most room without anything falling off the bottom. */
function fitConsole(
  space: Space,
  aspect: number,
  { stick, horizontalOnly, choice }: { stick: boolean; horizontalOnly: boolean; choice: boolean },
): Layout {
  const height = space.height - 4 // rounding slack
  const padding = Math.min(22, Math.max(10, space.viewport * 0.03))
  const padHeight = (size: number) => (stick ? size : horizontalOnly ? BUTTON : PAD)
  const startHeight = horizontalOnly ? 48 : BUTTON + 10 + 48
  const stackedWidth = Math.min(space.width, 420) - BORDER - 2 * padding - BEZEL
  // Portrait: screen above the controls, the way the console looks on a phone.
  const stacked = (size: number, grille: boolean): Layout => {
    const chrome =
      BORDER + 26 + HEADER + BEZEL + (choice ? GAP + BUTTON : 0) + GAP + Math.max(padHeight(size), startHeight) + (grille ? GRILLE : 0)
    return { kind: "stacked", stick: size, grille, screen: Math.min(stackedWidth, (height - chrome) * aspect, SCREEN_MAX) }
  }
  // Landscape: controls either side of the screen, for short windows.
  const sideStick = 96
  const sideWidth = BORDER + 24 + (stick ? sideStick : PAD) + 2 * SIDE_GAP + BEZEL + START_COLUMN
  const sideHeight = BORDER + 22 + HEADER
  const columns = Math.max(padHeight(sideStick) + (choice ? 10 + 2 * BUTTON + 3 : 0), BUTTON + 10 + 48 + 10 + 22)
  const side: Layout = {
    kind: "side",
    stick: sideStick,
    grille: true,
    screen: Math.min(space.width - sideWidth, (height - sideHeight - BEZEL) * aspect, SCREEN_MAX),
  }
  const candidates = [stacked(112, true), stacked(96, false)]
  if (height - sideHeight >= columns) candidates.push(side)
  // A new shape has to earn its place, so the console does not flip on small resizes.
  const best = candidates.reduce((kept, next) => (next.screen > kept.screen * 1.06 ? next : kept))
  const floor = SCREEN_MIN_HEIGHT * aspect
  if (best.screen >= floor) return { ...best, screen: Math.floor(best.screen) }
  // Nothing fits, as on a phone held sideways in a windowed view. Keep a playable screen
  // and pick the shape that leaves the least to scroll.
  return space.width - sideWidth >= floor
    ? { ...side, screen: Math.floor(floor) }
    : { ...stacked(96, false), screen: Math.floor(Math.max(0, Math.min(stackedWidth, floor))) }
}

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
  screenAspect,
  reserveHeight = 0,
}: HandheldConsoleProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [space, setSpace] = useState<Space | null>(null)

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current
    if (!section || !screenAspect) return
    const measure = () => {
      const next = measureSpace(section)
      setSpace((previous) =>
        previous && next && previous.width === next.width && previous.height === next.height && previous.viewport === next.viewport
          ? previous
          : next,
      )
    }
    measure()
    // Measure on the next frame: resizing the console from inside the observer callback
    // would report a resize loop.
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    if (section.parentElement) observer.observe(section.parentElement)
    const windowFrame = section.closest('[role="dialog"]')?.parentElement
    if (windowFrame) observer.observe(windowFrame)
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", schedule)
    }
  }, [screenAspect])

  const stick = controlMode === "stick" && !!onStick
  const layout =
    space && screenAspect
      ? fitConsole({ ...space, height: space.height - reserveHeight }, screenAspect, {
          stick,
          horizontalOnly,
          choice: !!onControlModeChange,
        })
      : null
  const side = layout?.kind === "side"

  const directions = [
    { direction: "UP" as const, icon: ArrowUp, row: 1, column: 2 },
    { direction: "LEFT" as const, icon: ArrowLeft, row: 2, column: 1 },
    { direction: "RIGHT" as const, icon: ArrowRight, row: 2, column: 3 },
    { direction: "DOWN" as const, icon: ArrowDown, row: 3, column: 2 },
  ]

  const screen = (
    <div
      style={{
        gridArea: "screen",
        position: "relative",
        boxSizing: "content-box",
        width: layout ? layout.screen : undefined,
        margin: layout && !side ? "0 auto" : undefined,
        flexShrink: 0,
        border: "7px solid #626d67",
        borderRadius: "7px 7px 18px 7px",
        boxShadow: "inset 0 2px 5px #0005, 0 1px 0 #fff",
        background: "#9bbb58",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )

  const choice = onControlModeChange && (
    <GameControlChoice value={controlMode} onChange={onControlModeChange} vertical={side} />
  )

  const movement = stick && onStick ? (
    <GameJoystick
      label={`${title} movement stick`}
      axis={horizontalOnly ? "horizontal" : "both"}
      fourWay={!horizontalOnly}
      onChange={onStick}
      disabled={controlsDisabled}
      size={layout?.stick ?? 112}
    />
  ) : (
    <div
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
  )

  const buttons = (
    <>
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
    </>
  )

  const grille = (
    <div aria-hidden="true" style={{ display: "flex", gap: 5, justifyContent: "flex-end", margin: side ? 0 : "8px 6px 0" }}>
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
  )

  const sideLeft = stick ? (layout?.stick ?? 96) : PAD

  // One grid for both shapes. The screen keeps its place in the tree, so switching shape
  // never remounts the game canvas (a fresh canvas would lose a menu drawn only once).
  return (
    <section
      ref={sectionRef}
      aria-label={`${title} handheld console`}
      className="game-touch"
      data-console-layout={layout?.kind ?? "stacked"}
      style={{
        display: "grid",
        gridTemplateColumns: side ? `${sideLeft}px max-content ${START_COLUMN}px` : "minmax(0, 1fr)",
        gridTemplateAreas: side ? '"header header header" "left screen right"' : '"header" "screen" "controls"',
        columnGap: side ? SIDE_GAP : 0,
        alignItems: "center",
        width: side && layout ? BORDER + 24 + sideLeft + 2 * SIDE_GAP + BEZEL + START_COLUMN + layout.screen : "min(100%, 420px)",
        maxWidth: "100%",
        padding: side ? "10px 12px 12px" : "12px clamp(10px, 3vw, 22px) 14px",
        border: "1px solid #adb3aa",
        borderRadius: "18px 18px 52px 18px",
        background: "linear-gradient(120deg, #f0f0e6, #d8dacf 78%, #bcc3ba)",
        boxShadow: "inset 3px 3px 1px #fff, inset -4px -4px 2px #b4bcb2, 0 7px 0 #89948c, 0 12px 18px #18292225",
        color: "#364938",
      }}
    >
      <header
        style={{
          gridArea: "header",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 20,
          margin: "0 0 8px",
          fontFamily: "'Trebuchet MS', Arial, sans-serif",
        }}
      >
        <strong style={{ fontSize: 14, letterSpacing: -0.5 }}>raffi pocket</strong>
        <span style={{ fontSize: 10 }}>{title}</span>
      </header>
      {screen}
      <div style={side ? { display: "contents" } : { gridArea: "controls", minWidth: 0 }}>
        {side ? (
          <>
            <div style={{ gridArea: "left", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              {movement}
              {choice}
            </div>
            <div style={{ gridArea: "right", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              {buttons}
              {grille}
            </div>
          </>
        ) : (
          <>
            {choice && <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>{choice}</div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
              {movement}
              <div
                style={{
                  display: "flex",
                  flexDirection: horizontalOnly ? "row" : "column",
                  alignItems: "center",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                {buttons}
              </div>
            </div>
            {(!layout || layout.grille) && grille}
          </>
        )}
      </div>
    </section>
  )
}
