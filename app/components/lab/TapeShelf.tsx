"use client"

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react"
import { ChevronLeft, ChevronRight, Pause, Play, Shuffle } from "lucide-react"
import { BADCOMPANY_MIXES, getRandomTrackIndex, type Track } from "@/data/audio-library"
import { useAudio } from "@/app/context/AudioContext"

interface TapeShelfProps {
  active?: boolean
  motionPaused?: boolean
}

const PAPER = "#eee8d8"
const INK = "#242424"
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const CONDENSED = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif'
const NUMERALS = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif'
const PALETTES = [
  { paper: "#efe8d6", ink: "#233e85", accent: "#df492a", stripe: "#e5b947" },
  { paper: "#e2bb44", ink: "#252b31", accent: "#1646aa", stripe: "#e65c39" },
  { paper: "#d94b32", ink: "#fff1d8", accent: "#f2c846", stripe: "#294581" },
  { paper: "#254b97", ink: "#f5edd8", accent: "#e96337", stripe: "#e6be4a" },
  { paper: "#d4d8c4", ink: "#303e31", accent: "#ce492f", stripe: "#d7ad44" },
] as const

// Fine ruling and fibre for the paper inserts and labels.
const PAPER_GRAIN = "repeating-linear-gradient(0deg, rgba(40, 30, 20, 0.035) 0 1px, transparent 1px 3px)"
const WOOD_GRAIN = "repeating-linear-gradient(90deg, rgba(40, 22, 10, 0.07) 0 2px, transparent 2px 9px, rgba(255, 230, 190, 0.05) 9px 10px, transparent 10px 17px)"

function packaging(track: Track) {
  let hash = 0
  for (const character of `${track.id}:${track.title}:${track.artist}`) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0
  }
  const value = hash >>> 0
  return { ...PALETTES[value % PALETTES.length], band: value % 3 }
}

function matchesTrack(a: Track | null, b: Track) {
  return Boolean(a && (a.id === b.id || a.url === b.url))
}

const catalogue = (index: number) => `BC / ${String(index + 1).padStart(3, "0")}`

function Reel({ spinning, reverse = false }: { spinning: boolean; reverse?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      aria-hidden="true"
      className="tape-shelf-reel"
      style={{ animationPlayState: spinning ? "running" : "paused", animationDirection: reverse ? "reverse" : "normal" }}
    >
      <circle cx="32" cy="32" r="21" fill="#f1ede3" stroke="#b9b3a5" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="12.5" fill="#d9d3c4" />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect key={angle} x="29.5" y="12" width="5" height="9" rx="1" fill="#2a2724" transform={`rotate(${angle} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="6.5" fill="#2a2724" />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect key={`tooth-${angle}`} x="30.6" y="24.4" width="2.8" height="3.4" fill="#d9d3c4" transform={`rotate(${angle} 32 32)`} />
      ))}
    </svg>
  )
}

/** The brown tape wound on a hub; it grows or shrinks as the mix plays through. */
function TapePack({ fill, motionPaused }: { fill: number; motionPaused: boolean }) {
  const size = `${Math.round(52 + fill * 46)}%`
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: "radial-gradient(circle, #3b2a1d 0 52%, #5a3f2a 53%, #4a3322 70%, #5e432c 71%, #3d2b1e 100%)",
        boxShadow: "inset 0 0 0 1px #1d140d, 0 1px 0 rgba(255, 255, 255, 0.08)",
        transition: motionPaused ? "none" : "width 900ms linear",
      }}
    />
  )
}

function Cassette({ track, index, spinning, progress, motionPaused }: { track: Track; index: number; spinning: boolean; progress: number; motionPaused: boolean }) {
  const palette = packaging(track)
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 400,
        aspectRatio: "1.58",
        margin: "0 auto",
        padding: "4.5% 5% 9%",
        background: "linear-gradient(160deg, #4b5154 0%, #30363a 42%, #22272a 74%, #1b1f22 100%)",
        border: "1.5px solid #121619",
        borderRadius: "5% / 8%",
        boxShadow: "inset 0 1.5px 0 rgba(255, 255, 255, 0.28), inset 0 -2px 0 rgba(0, 0, 0, 0.45), 0 2px 0 #121619, 0 18px 26px rgba(30, 20, 10, 0.32), 0 6px 8px rgba(30, 20, 10, 0.22)",
        boxSizing: "border-box",
      }}
    >
      {/* Molded edge highlight: the shell catches the shelf light along its top. */}
      <span style={{ position: "absolute", inset: "2px 3% auto", height: "38%", borderRadius: "999px 999px 0 0 / 40px 40px 0 0", background: "linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent)", pointerEvents: "none" }} />
      {[["2.6%", "4%"], ["95%", "4%"], ["2.6%", "86%"], ["95%", "86%"]].map(([left, top], screw) => (
        <span key={screw} style={{ position: "absolute", left, top, width: 7, height: 7, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #c3c6c2, #6c706d 55%, #2d3131)", boxShadow: "0 0 0 1px #111517" }}>
          <span style={{ position: "absolute", left: "50%", top: "18%", bottom: "18%", width: 1.2, background: "#262a2a", transform: `translateX(-50%) rotate(${35 + screw * 40}deg)` }} />
        </span>
      ))}
      <div
        style={{
          position: "relative",
          height: "100%",
          backgroundColor: palette.paper,
          backgroundImage: PAPER_GRAIN,
          color: palette.ink,
          borderRadius: "3% / 5%",
          overflow: "hidden",
          border: "1px solid rgba(0, 0, 0, 0.55)",
          boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.18), inset 0 -10px 18px rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3% 4% 0", gap: 10, fontFamily: MONO, fontWeight: 600, fontSize: "clamp(7px, 1.25vw, 9.5px)", letterSpacing: 0.6, lineHeight: 1.1 }}>
          <span>BADCOMPANY</span>
          <span>SIDE A</span>
          <span>{catalogue(index)}</span>
        </div>
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0, alignItems: "center", gap: "4%", padding: "1% 4% 2%" }}>
          <span style={{ fontFamily: NUMERALS, fontSize: "clamp(32px, 6.6vw, 58px)", lineHeight: 0.9, letterSpacing: -1 }}>{String(index + 1).padStart(2, "0")}</span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: CONDENSED,
              fontStretch: "condensed",
              fontWeight: 700,
              fontSize: "clamp(12px, 2.1vw, 18px)",
              lineHeight: "1.32em",
              textTransform: "uppercase",
              // Ruled writing lines, like a blank label filled in by hand.
              backgroundImage: `repeating-linear-gradient(180deg, transparent 0 calc(1.32em - 1px), ${palette.ink}33 calc(1.32em - 1px) 1.32em)`,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {track.title}
          </span>
        </div>
        <div style={{ position: "relative", flex: "0 0 38%", margin: "0 8% 3%", borderRadius: 40, background: "linear-gradient(180deg, #0b1114, #172126 55%, #0d1417)", border: "2px solid #4a4f4b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3%", boxShadow: "inset 0 4px 10px rgba(0, 0, 0, 0.8), 0 1px 0 rgba(255, 255, 255, 0.25)" }}>
          {/* The tape runs from the left pack to the right one as the mix plays. */}
          <span style={{ position: "absolute", left: "22%", right: "22%", bottom: "16%", height: 2, background: "#5a3f2a", opacity: 0.85 }} />
          {[1 - progress, progress].map((fill, side) => (
            <span key={side} style={{ position: "relative", width: "30%", aspectRatio: "1", display: "grid", placeItems: "center", zIndex: 1 }}>
              <TapePack fill={fill} motionPaused={motionPaused} />
              <span style={{ position: "relative", width: "62%", aspectRatio: "1" }}><Reel spinning={spinning} reverse={side === 1} /></span>
            </span>
          ))}
          {/* Smoked window glass. */}
          <span style={{ position: "absolute", inset: 0, borderRadius: 40, background: "linear-gradient(115deg, rgba(255, 255, 255, 0.14) 0 18%, transparent 30% 62%, rgba(255, 255, 255, 0.06) 70%, transparent 80%)", pointerEvents: "none", zIndex: 2 }} />
        </div>
        <div style={{ display: "flex", flex: "0 0 13%" }}>
          {[palette.ink, palette.accent, palette.stripe, palette.accent].map((color, stripe) => <span key={stripe} style={{ background: color, flex: stripe === palette.band ? 3 : 1 }} />)}
        </div>
      </div>
      <div style={{ position: "absolute", left: "23%", right: "23%", bottom: 0, height: "9%", background: "linear-gradient(180deg, #353c3f, #262c2f)", border: "1px solid #101518", borderBottom: 0, clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
        {[0, 1, 2, 3, 4].map((hole) => <span key={hole} style={{ width: hole === 2 ? "18%" : "6%", height: "42%", background: "#0c1113", borderRadius: 3, boxShadow: "inset 0 1px 2px #000" }} />)}
      </div>
    </div>
  )
}

const controlStyle: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 14px",
  border: "1px solid #383a35",
  borderRadius: 3,
  fontFamily: "Tahoma, Verdana, sans-serif",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(36, 36, 36, 0.35)",
}

export default function TapeShelf({ active = true, motionPaused = false }: TapeShelfProps) {
  const { currentTrack, isPlaying, isLoading, needsTap, error, currentTime, duration, playTrack, togglePlay, setPlaylist } = useAudio()
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, BADCOMPANY_MIXES.findIndex((track) => matchesTrack(currentTrack, track))))
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(true)
  const spineRefs = useRef<Array<HTMLButtonElement | null>>([])
  const rackRef = useRef<HTMLDivElement>(null)
  const selectedTrack = BADCOMPANY_MIXES[selectedIndex]
  const selectedIsCurrent = matchesTrack(currentTrack, selectedTrack)
  const playingSelection = selectedIsCurrent && isPlaying && !isLoading && !needsTap && !error
  const tapToPlay = selectedIsCurrent && needsTap
  const pausedMotion = motionPaused || reducedMotion
  const palette = packaging(selectedTrack)
  const progress = selectedIsCurrent && duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener("change", update)
    return () => preference.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const index = BADCOMPANY_MIXES.findIndex((track) => matchesTrack(currentTrack, track))
    if (index >= 0) setSelectedIndex(index)
  }, [currentTrack])

  useEffect(() => {
    if (!active) return
    const spine = spineRefs.current[selectedIndex]
    const rack = rackRef.current
    if (!spine || !rack) return
    const tapeBounds = spine.getBoundingClientRect()
    const rackBounds = rack.getBoundingClientRect()
    const distance = tapeBounds.left < rackBounds.left
      ? tapeBounds.left - rackBounds.left - 12
      : tapeBounds.right > rackBounds.right
        ? tapeBounds.right - rackBounds.right + 12
        : 0
    if (distance) rack.scrollBy({ left: distance, behavior: pausedMotion ? "auto" : "smooth" })
  }, [selectedIndex, active, pausedMotion])

  const play = (index: number) => {
    setSelectedIndex(index)
    setPlaylist(BADCOMPANY_MIXES)
    playTrack(BADCOMPANY_MIXES[index])
  }

  const toggleSelected = () => {
    if (selectedIsCurrent) {
      if (error) playTrack(selectedTrack)
      else togglePlay()
    } else play(selectedIndex)
  }

  const pickForMe = () => {
    const currentIndex = BADCOMPANY_MIXES.findIndex((track) => matchesTrack(currentTrack, track))
    play(getRandomTrackIndex(BADCOMPANY_MIXES.length, currentIndex >= 0 ? currentIndex : selectedIndex))
  }

  const browse = (direction: number) => setSelectedIndex((index) => (index + direction + BADCOMPANY_MIXES.length) % BADCOMPANY_MIXES.length)

  // Arrow keys walk the rack like flipping along a shelf; Home/End jump to its ends.
  const walkRack = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = BADCOMPANY_MIXES.length - 1
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(last, index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(0, index - 1)
        : event.key === "Home" ? 0
          : event.key === "End" ? last
            : null
    if (next === null) return
    event.preventDefault()
    setSelectedIndex(next)
    spineRefs.current[next]?.focus()
  }

  const status = selectedIsCurrent && error
    ? "Couldn’t load this mix. Try Play again."
    : tapToPlay
      ? "Tap to play. Your browser is waiting for a playback gesture."
      : selectedIsCurrent && isLoading && isPlaying
        ? "Loading from SoundCloud…"
        : playingSelection
          ? "Playing on the desktop"
          : selectedIsCurrent
            ? "Paused"
            : "Pull a tape. Press play."

  return (
    <section
      data-lab-experiment="tape-shelf"
      data-selected-tape={selectedTrack.id}
      data-motion-paused={pausedMotion || !active ? "true" : "false"}
      aria-label="Tape Shelf"
      style={{ background: PAPER, color: INK, fontFamily: "Tahoma, Verdana, sans-serif", overflow: "hidden", border: "1px solid #c4beac", borderRadius: 4 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: "1px solid #c4beac", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontFamily: NUMERALS, fontSize: 24, lineHeight: 1, letterSpacing: 0.4 }}>BADCOMPANY</span>
          <span style={{ fontSize: 11 }}>Tape archive</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#605b4e" }}>{BADCOMPANY_MIXES.length} mixes / select a spine</span>
      </div>

      {/* The rack: a wall-mounted wooden shelf under a warm spot. */}
      <div style={{ position: "relative", padding: "16px 12px 0", background: "radial-gradient(ellipse 70% 120% at 50% -20%, rgba(255, 214, 150, 0.32), transparent 62%), linear-gradient(180deg, #3a2f28, #2a221d)" }}>
        <div style={{ position: "relative", borderRadius: "4px 4px 0 0", padding: "10px 10px 0", backgroundColor: "#6a4c33", backgroundImage: `${WOOD_GRAIN}, linear-gradient(180deg, #8a6646, #5f432d)`, boxShadow: "inset 0 2px 0 rgba(255, 220, 170, 0.25), 0 10px 20px rgba(0, 0, 0, 0.35)" }}>
          <div
            ref={rackRef}
            role="group"
            aria-label="Mix tapes"
            tabIndex={0}
            className="tape-shelf-rack"
            style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 4, overflowX: "auto", overflowY: "hidden", padding: "26px 8px 8px", minWidth: 0, overscrollBehaviorX: "contain", scrollbarWidth: "thin", scrollbarColor: "#b7a78d #3a2c22", background: "linear-gradient(180deg, #2a1d14 0%, #3b2a1d 70%, #2c1f15 100%)", borderRadius: "3px 3px 0 0", boxShadow: "inset 0 10px 16px rgba(0, 0, 0, 0.55), inset 0 -4px 10px rgba(0, 0, 0, 0.4)" }}
          >
            {BADCOMPANY_MIXES.map((track, index) => {
              const spinePalette = packaging(track)
              const selected = index === selectedIndex
              const hovered = index === hoveredIndex
              const isCurrent = matchesTrack(currentTrack, track)
              const lift = selected ? -18 : hovered && !pausedMotion ? -7 : 0
              return (
                <button
                  key={track.id}
                  ref={(node) => { spineRefs.current[index] = node }}
                  type="button"
                  aria-label={`Select tape ${index + 1}: ${track.title}`}
                  aria-pressed={selected}
                  data-tape-id={track.id}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(event) => walkRack(event, index)}
                  onPointerEnter={() => setHoveredIndex(index)}
                  onPointerLeave={() => setHoveredIndex(null)}
                  className="tape-shelf-spine"
                  style={{
                    position: "relative",
                    flex: "0 0 46px",
                    width: 46,
                    height: 190,
                    padding: 0,
                    overflow: "hidden",
                    backgroundColor: spinePalette.paper,
                    backgroundImage: PAPER_GRAIN,
                    color: spinePalette.ink,
                    border: "1px solid rgba(10, 8, 6, 0.9)",
                    borderRadius: 2,
                    boxShadow: selected
                      ? "0 0 0 2px #fff4d9, 0 16px 18px rgba(0, 0, 0, 0.55), 0 4px 6px rgba(0, 0, 0, 0.4)"
                      : "0 4px 6px rgba(0, 0, 0, 0.45)",
                    transform: `translateY(${lift}px)`,
                    transition: pausedMotion ? "none" : "transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1.2), box-shadow 200ms ease-out",
                    cursor: "pointer",
                  }}
                >
                  {/* Printed J-card spine. */}
                  <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 10, background: `linear-gradient(90deg, ${spinePalette.accent} 0 45%, ${spinePalette.stripe} 45% 72%, ${spinePalette.ink} 72%)` }} />
                  <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 13, fontFamily: MONO, fontSize: 8, fontWeight: 600, letterSpacing: 0.4, textAlign: "center" }}>BC</span>
                  <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 26, bottom: 40, display: "flex", justifyContent: "center", overflow: "hidden" }}>
                    <span style={{ writingMode: "vertical-rl", fontFamily: CONDENSED, fontStretch: "condensed", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxHeight: "100%" }}>{track.title}</span>
                  </span>
                  <span aria-hidden="true" style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", fontFamily: NUMERALS, fontSize: 23, lineHeight: 1 }}>{String(index + 1).padStart(2, "0")}</span>
                  {/* Clear case: edge highlights and a soft gloss over the print. */}
                  <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(255, 255, 255, 0.45) 0 2px, rgba(255, 255, 255, 0.12) 2px 9px, transparent 16px calc(100% - 6px), rgba(0, 0, 0, 0.28) calc(100% - 3px))", pointerEvents: "none" }} />
                  {isCurrent && <span aria-hidden="true" style={{ position: "absolute", right: 4, top: 14, width: 6, height: 6, borderRadius: "50%", background: isPlaying && !isLoading && !needsTap && !error ? "#30d07f" : "#e5b947", boxShadow: "0 0 0 1px #252b2d, 0 0 6px rgba(48, 208, 127, 0.7)" }} />}
                </button>
              )
            })}
          </div>
          {/* The shelf lip sits in front of the tapes, so a pulled tape rises above it. */}
          <div aria-hidden="true" style={{ position: "relative", zIndex: 1, height: 18, margin: "-14px -10px 0", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#7a5839", backgroundImage: `${WOOD_GRAIN}, linear-gradient(180deg, #a07a54 0, #7b583a 30%, #5a3f29 100%)`, boxShadow: "0 -1px 0 rgba(255, 225, 180, 0.4), 0 6px 10px rgba(0, 0, 0, 0.45)", pointerEvents: "none" }}>
            <span style={{ padding: "1px 8px", fontFamily: MONO, fontSize: 8, letterSpacing: 1.2, color: "#3a2a14", background: "linear-gradient(180deg, #e3c27a, #b8924a)", borderRadius: 1, boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 1px rgba(0, 0, 0, 0.4)" }}>BADCO ARCHIVE · SIDE A</span>
          </div>
        </div>
        <div aria-hidden="true" style={{ height: 14 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", alignItems: "center", gap: "24px 28px", padding: "28px clamp(14px, 3vw, 28px) 24px", background: "radial-gradient(ellipse 80% 90% at 28% 30%, #f7f1e2, #e8dfc9 70%, #ded3ba)" }}>
        <div data-selected-cassette={selectedTrack.id} key={selectedTrack.id} className={pausedMotion ? undefined : "tape-shelf-pull"} style={{ minWidth: 0 }}>
          <Cassette track={selectedTrack} index={selectedIndex} spinning={playingSelection && !isLoading && active && !pausedMotion} progress={progress} motionPaused={pausedMotion || !active} />
        </div>
        {/* The J-card insert: the details and controls for the pulled tape. */}
        <div style={{ position: "relative", minWidth: 0, padding: "16px 18px 14px", backgroundColor: "#fbf7ec", backgroundImage: PAPER_GRAIN, border: "1px solid #d3c9b1", borderLeft: `6px solid ${palette.accent}`, borderRadius: 2, boxShadow: "0 1px 0 #fff inset, 0 8px 18px rgba(60, 45, 20, 0.14), 0 2px 3px rgba(60, 45, 20, 0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 0.6, color: "#625b4e" }}>{catalogue(selectedIndex)} · SIDE A</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button type="button" aria-label="Previous tape" className="tape-shelf-control" style={{ ...controlStyle, width: 44, padding: 0, background: "#ece4d1", color: INK }} onClick={() => browse(-1)}><ChevronLeft size={17} aria-hidden="true" /></button>
              <button type="button" aria-label="Next tape" className="tape-shelf-control" style={{ ...controlStyle, width: 44, padding: 0, background: "#ece4d1", color: INK }} onClick={() => browse(1)}><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
          </div>
          <div style={{ display: "flex", height: 6, marginBottom: 12 }}>
            {[palette.ink, palette.accent, palette.stripe, palette.accent].map((color, stripe) => <span key={stripe} style={{ background: color, flex: stripe === palette.band ? 3 : 1 }} />)}
          </div>
          <h3 data-tape-title style={{ margin: "0 0 6px", fontFamily: CONDENSED, fontStretch: "condensed", fontSize: "clamp(20px, 3.2vw, 28px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.2, overflowWrap: "anywhere" }}>{selectedTrack.title}</h3>
          <p style={{ margin: "0 0 18px", fontSize: 12, lineHeight: 1.5, color: "#625b4e", overflowWrap: "anywhere" }}>{selectedTrack.artist}</p>
          <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              aria-label={tapToPlay ? "Tap to play selected mix" : playingSelection ? "Pause selected mix" : "Play selected mix"}
              className="tape-shelf-control"
              onClick={toggleSelected}
              style={{ ...controlStyle, background: INK, color: "#fff7e7", minWidth: 104 }}
            >
              {playingSelection ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {tapToPlay ? "Tap to play" : playingSelection ? "Pause" : selectedIsCurrent && isLoading && isPlaying ? "Tuning in…" : selectedIsCurrent && !error ? "Resume" : "Play mix"}
            </button>
            <button type="button" aria-label="Pick a mix for me" className="tape-shelf-control" onClick={pickForMe} style={{ ...controlStyle, background: "#ece4d1", color: INK }}><Shuffle size={15} aria-hidden="true" />Pick for me</button>
          </div>
          <p role="status" aria-live="polite" style={{ margin: "12px 0 0", minHeight: 18, fontSize: 11, lineHeight: 1.5, color: selectedIsCurrent && error ? "#a12820" : "#625b4e" }}>{status}</p>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #c4beac", padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 10, color: "#625b4e" }}>
        <span>Music keeps playing when you close the shelf.</span>
        <span>Streamed from SoundCloud</span>
      </div>
      <style jsx>{`
        .tape-shelf-spine:focus-visible,
        .tape-shelf-control:focus-visible,
        .tape-shelf-rack:focus-visible {
          outline: 3px solid #1265c6;
          outline-offset: 3px;
        }
        .tape-shelf-control:hover { filter: brightness(1.08); }
        .tape-shelf-control:active { filter: brightness(0.94); transform: translateY(1px); box-shadow: 0 1px 0 rgba(36, 36, 36, 0.35) !important; }
        @media (prefers-reduced-motion: reduce) {
          .tape-shelf-spine { transition: none !important; }
        }
      `}</style>
      <style jsx global>{`
        @keyframes tape-shelf-turn { to { transform: rotate(360deg); } }
        @keyframes tape-shelf-slide { from { opacity: 0; transform: translateY(-16px) rotate(-1.5deg); } to { opacity: 1; transform: none; } }
        .tape-shelf-reel {
          animation-name: tape-shelf-turn;
          animation-duration: 4s;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .tape-shelf-pull { animation: tape-shelf-slide 260ms cubic-bezier(0.2, 0.9, 0.3, 1.1); }
        @media (prefers-reduced-motion: reduce) {
          .tape-shelf-reel { animation-name: none; }
          .tape-shelf-pull { animation: none; }
        }
      `}</style>
    </section>
  )
}
