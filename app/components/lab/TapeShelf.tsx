"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ChevronLeft, ChevronRight, Pause, Play, Shuffle } from "lucide-react"
import { BADCOMPANY_MIXES, getRandomTrackIndex, type Track } from "@/data/audio-library"
import { useAudio } from "@/app/context/AudioContext"

interface TapeShelfProps {
  active?: boolean
  motionPaused?: boolean
}

const PAPER = "#eee8d8"
const INK = "#242424"
const MONO = '"Courier New", monospace'
const CONDENSED = 'Impact, "Arial Narrow", sans-serif'
const PALETTES = [
  { paper: "#efe8d6", ink: "#233e85", accent: "#df492a", stripe: "#e5b947" },
  { paper: "#e2bb44", ink: "#252b31", accent: "#1646aa", stripe: "#e65c39" },
  { paper: "#d94b32", ink: "#fff1d8", accent: "#f2c846", stripe: "#294581" },
  { paper: "#254b97", ink: "#f5edd8", accent: "#e96337", stripe: "#e6be4a" },
  { paper: "#d4d8c4", ink: "#303e31", accent: "#ce492f", stripe: "#d7ad44" },
] as const

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
      <circle cx="32" cy="32" r="29" fill="#c8c6bc" stroke="#0f1619" strokeWidth="3" />
      <circle cx="32" cy="32" r="21" fill="#4e4134" stroke="#73716a" strokeWidth="2" />
      <circle cx="32" cy="32" r="11" fill="#e4e0d5" />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect key={angle} x="29" y="9" width="6" height="15" rx="1" fill="#e4e0d5" transform={`rotate(${angle} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="5" fill="#171e22" />
    </svg>
  )
}

function Cassette({ track, index, spinning }: { track: Track; index: number; spinning: boolean }) {
  const palette = packaging(track)
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 390,
        aspectRatio: "1.58",
        margin: "0 auto",
        padding: "4.5% 5% 8%",
        background: "linear-gradient(155deg, #505557 0%, #31383b 50%, #20272a 100%)",
        border: "2px solid #171d20",
        borderRadius: "5% / 8%",
        boxShadow: "0 8px 0 #1b2225, 0 13px 18px #00000032, inset 0 2px 0 #93958e",
        boxSizing: "border-box",
      }}
    >
      {[["3%", "4%"], ["94%", "4%"], ["3%", "87%"], ["94%", "87%"]].map(([left, top], screw) => (
        <span key={screw} style={{ position: "absolute", left, top, width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(45deg, #8a8e8b 42%, #262c2d 44% 56%, #8a8e8b 58%)", boxShadow: "0 0 0 1px #151b1e" }} />
      ))}
      <div
        style={{
          position: "relative",
          height: "100%",
          background: palette.paper,
          color: palette.ink,
          borderRadius: "3% / 5%",
          overflow: "hidden",
          border: "1px solid #1a1d1d",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3% 4% 0", gap: 10, fontFamily: MONO, fontWeight: 700, fontSize: "clamp(8px, 1.4vw, 10px)", lineHeight: 1.1 }}>
          <span>BADCOMPANY</span>
          <span>BC / {String(index + 1).padStart(3, "0")}</span>
        </div>
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0, alignItems: "center", gap: 10, padding: "1% 4% 2%" }}>
          <span style={{ fontFamily: CONDENSED, fontSize: "clamp(34px, 7vw, 60px)", lineHeight: 1, letterSpacing: -2 }}>{String(index + 1).padStart(2, "0")}</span>
          <span style={{ fontFamily: CONDENSED, fontSize: "clamp(12px, 2.2vw, 19px)", lineHeight: 1.05, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden", overflowWrap: "anywhere" }}>{track.title}</span>
        </div>
        <div style={{ position: "relative", flex: "0 0 35%", margin: "0 7% 3%", borderRadius: 30, background: "#10191d", border: "2px solid #575b56", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2%", boxShadow: "inset 0 3px 8px #000000a0" }}>
          <span style={{ width: "26%", aspectRatio: "1", display: "block", zIndex: 1 }}><Reel spinning={spinning} /></span>
          <span style={{ position: "absolute", inset: "37% 12%", background: "#65513a", borderTop: "2px solid #9a7b51", borderBottom: "2px solid #332d26" }} />
          <span style={{ width: "26%", aspectRatio: "1", display: "block", zIndex: 1 }}><Reel spinning={spinning} reverse /></span>
        </div>
        <div style={{ display: "flex", flex: "0 0 14%" }}>
          {[palette.ink, palette.accent, palette.stripe, palette.accent].map((color, stripe) => <span key={stripe} style={{ background: color, flex: stripe === palette.band ? 3 : 1 }} />)}
        </div>
      </div>
      <div style={{ position: "absolute", left: "24%", right: "24%", bottom: 0, height: "8%", background: "#30383a", border: "1px solid #101619", clipPath: "polygon(10% 0, 90% 0, 100% 100%, 0 100%)", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
        {[0, 1, 2].map((hole) => <span key={hole} style={{ width: hole === 1 ? "22%" : "7%", height: "45%", background: "#11191c", borderRadius: 4 }} />)}
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
}

export default function TapeShelf({ active = true, motionPaused = false }: TapeShelfProps) {
  const { currentTrack, isPlaying, isLoading, needsTap, error, playTrack, togglePlay, setPlaylist } = useAudio()
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
      ? tapeBounds.left - rackBounds.left - 5
      : tapeBounds.right > rackBounds.right
        ? tapeBounds.right - rackBounds.right + 5
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
          <span style={{ fontFamily: CONDENSED, fontSize: 24, lineHeight: 1, letterSpacing: -0.4 }}>BADCOMPANY</span>
          <span style={{ fontSize: 11 }}>Tape archive</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#605b4e" }}>{BADCOMPANY_MIXES.length} mixes / select a spine</span>
      </div>

      <div style={{ padding: "12px 10px 0", background: "linear-gradient(180deg, #6e6052, #4f443b)", boxShadow: "inset 0 4px 10px #211a1640" }}>
        <div
          ref={rackRef}
          role="group"
          aria-label="Mix tapes"
          tabIndex={0}
          className="tape-shelf-rack"
          style={{ display: "flex", alignItems: "flex-end", gap: 5, overflowX: "auto", overflowY: "hidden", padding: "17px 5px 13px", scrollbarWidth: "thin", scrollbarColor: "#b7a78d #3a322c", minWidth: 0, overscrollBehaviorX: "contain" }}
        >
          {BADCOMPANY_MIXES.map((track, index) => {
            const palette = packaging(track)
            const selected = index === selectedIndex
            const hovered = index === hoveredIndex
            const isCurrent = matchesTrack(currentTrack, track)
            const pull = selected ? -12 : hovered && !pausedMotion ? -6 : 0
            return (
              <button
                key={track.id}
                ref={(node) => { spineRefs.current[index] = node }}
                type="button"
                aria-label={`Select tape ${index + 1}: ${track.title}`}
                aria-pressed={selected}
                data-tape-id={track.id}
                onClick={() => setSelectedIndex(index)}
                onPointerEnter={() => setHoveredIndex(index)}
                onPointerLeave={() => setHoveredIndex(null)}
                className="tape-shelf-spine"
                style={{
                  position: "relative",
                  flex: "0 0 44px",
                  width: 44,
                  height: 179,
                  padding: 0,
                  background: palette.paper,
                  color: palette.ink,
                  border: selected ? "2px solid #fff9e8" : "2px solid #252b2d",
                  borderRadius: 2,
                  boxShadow: selected ? "3px 6px 6px #18110d70, inset -4px 0 0 #00000015" : "2px 3px 3px #18110d70, inset -4px 0 0 #00000015",
                  transform: `translateY(${pull}px) rotate(${selected && !pausedMotion ? -2 : 0}deg)`,
                  transition: pausedMotion ? "none" : "transform 180ms ease-out, box-shadow 180ms ease-out",
                  cursor: "pointer",
                }}
              >
                <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 9, background: `linear-gradient(90deg, ${palette.accent} 0 45%, ${palette.stripe} 45% 70%, ${palette.ink} 70%)` }} />
                <span aria-hidden="true" style={{ position: "absolute", left: 8, top: 17, bottom: 37, writingMode: "vertical-rl", fontSize: 11, lineHeight: "22px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxHeight: 122 }}>{track.title}</span>
                <span aria-hidden="true" style={{ position: "absolute", bottom: 5, left: 0, right: 0, fontFamily: CONDENSED, fontSize: 24, lineHeight: 1 }}>{String(index + 1).padStart(2, "0")}</span>
                {isCurrent && <span aria-hidden="true" style={{ position: "absolute", right: 3, top: 13, width: 5, height: 5, borderRadius: "50%", background: isPlaying && !isLoading && !needsTap && !error ? "#30bd75" : "#e5b947", boxShadow: "0 0 0 1px #252b2d" }} />}
              </button>
            )
          })}
        </div>
        <div style={{ position: "relative", height: 10, margin: "0 -10px", background: "linear-gradient(180deg, #9c856b 0 25%, #6d5946 26% 60%, #4a3d32 61%)", boxShadow: "0 3px 5px #00000030" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", alignItems: "center", gap: "26px 24px", padding: "26px clamp(14px, 3vw, 26px) 22px" }}>
        <div data-selected-cassette={selectedTrack.id} style={{ minWidth: 0 }}>
          <Cassette track={selectedTrack} index={selectedIndex} spinning={playingSelection && !isLoading && active && !pausedMotion} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#625b4e" }}>BC / {String(selectedIndex + 1).padStart(3, "0")}</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button type="button" aria-label="Previous tape" className="tape-shelf-control" style={{ ...controlStyle, width: 44, padding: 0, background: "#e3ddce", color: INK }} onClick={() => browse(-1)}><ChevronLeft size={17} aria-hidden="true" /></button>
              <button type="button" aria-label="Next tape" className="tape-shelf-control" style={{ ...controlStyle, width: 44, padding: 0, background: "#e3ddce", color: INK }} onClick={() => browse(1)}><ChevronRight size={17} aria-hidden="true" /></button>
            </div>
          </div>
          <h3 data-tape-title style={{ margin: "0 0 7px", fontSize: "clamp(18px, 3vw, 25px)", fontWeight: 700, lineHeight: 1.15, overflowWrap: "anywhere" }}>{selectedTrack.title}</h3>
          <p style={{ margin: "0 0 19px", fontSize: 12, lineHeight: 1.5, color: "#625b4e", overflowWrap: "anywhere" }}>{selectedTrack.artist}</p>
          <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              aria-label={tapToPlay ? "Tap to play selected mix" : playingSelection ? "Pause selected mix" : "Play selected mix"}
              className="tape-shelf-control"
              onClick={toggleSelected}
              style={{ ...controlStyle, background: INK, color: "#fff7e7", minWidth: 98 }}
            >
              {playingSelection ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {tapToPlay ? "Tap to play" : playingSelection ? "Pause" : selectedIsCurrent && isLoading && isPlaying ? "Tuning in…" : selectedIsCurrent && !error ? "Resume" : "Play mix"}
            </button>
            <button type="button" aria-label="Pick a mix for me" className="tape-shelf-control" onClick={pickForMe} style={{ ...controlStyle, background: "#e3ddce", color: INK }}><Shuffle size={15} aria-hidden="true" />Pick for me</button>
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
        .tape-shelf-control:hover { filter: brightness(1.1); }
        .tape-shelf-control:active { filter: brightness(0.94); }
        @media (prefers-reduced-motion: reduce) {
          .tape-shelf-spine { transition: none !important; }
        }
      `}</style>
      <style jsx global>{`
        @keyframes tape-shelf-turn { to { transform: rotate(360deg); } }
        .tape-shelf-reel {
          animation-name: tape-shelf-turn;
          animation-duration: 4s;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tape-shelf-reel { animation-name: none; }
        }
      `}</style>
    </section>
  )
}
