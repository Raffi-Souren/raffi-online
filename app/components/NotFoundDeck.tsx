"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { BADCOMPANY_MIXES } from "@/data/audio-library"
import { useAudio } from "../context/AudioContext"

const TAHOMA = "Tahoma, Verdana, 'Segoe UI', sans-serif"
const FACEPLATE = "linear-gradient(180deg, #f3f5f7 0%, #cfd5db 46%, #b9c1c9 54%, #dfe4e9 100%)"

const xpButton: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 16px",
  fontFamily: TAHOMA, fontSize: 13, color: "#111827", textDecoration: "none",
  background: "linear-gradient(#ffffff, #ece9d8)", border: "1px solid #003c74", borderRadius: 3, cursor: "pointer",
}

/** A missing address always lands on the same mix, so a broken link has its own soundtrack. */
function mixFor(path: string) {
  let hash = 0
  for (let index = 0; index < path.length; index++) hash = (hash * 31 + path.charCodeAt(index)) >>> 0
  return BADCOMPANY_MIXES[hash % BADCOMPANY_MIXES.length]
}

/** The 404 page: an XP error box with a tape deck in it. Sound waits for a press. */
export default function NotFoundDeck() {
  const [path, setPath] = useState("")
  const { currentTrack, isPlaying, isLoading, needsTap, error, setPlaylist, playTrack, togglePlay } = useAudio()
  useEffect(() => setPath(window.location.pathname), [])

  const mix = mixFor(path)
  const mixSelected = Boolean(currentTrack && BADCOMPANY_MIXES.some((entry) => entry.id === currentTrack.id))
  const playing = mixSelected && isPlaying
  const loading = mixSelected && isLoading && !needsTap
  const deck = mixSelected && error ? "error" : loading ? "loading" : playing && !needsTap ? "playing" : "idle"
  const label = mixSelected && error ? "Try again" : mixSelected && needsTap ? "Tap to play" : loading ? "Tuning in…" : playing ? "Pause the mix" : mixSelected ? "Resume the mix" : "Play the mix"

  const play = () => {
    if (mixSelected) {
      if (error && currentTrack) playTrack(currentTrack)
      else togglePlay()
      return
    }
    setPlaylist(BADCOMPANY_MIXES)
    playTrack(mix)
  }

  return (
    <main
      style={{
        minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px 12px calc(24px + env(safe-area-inset-bottom, 0px))",
        fontFamily: TAHOMA, backgroundColor: "#245DDA", backgroundImage: "url(/windows-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center",
      }}
    >
      <section
        role="alertdialog"
        aria-labelledby="not-found-title"
        aria-describedby="not-found-text"
        data-not-found
        style={{ width: "min(460px, 100%)", borderRadius: "8px 8px 4px 4px", border: "1px solid #0b3fb5", background: "#ece9d8", boxShadow: "0 18px 50px rgba(0, 0, 0, 0.45)", overflow: "hidden" }}
      >
        <header style={{ display: "flex", alignItems: "center", minHeight: 32, padding: "0 10px", color: "#ffffff", fontWeight: 700, fontSize: 13, background: "linear-gradient(180deg, #2f7ef7 0%, #0b56d8 55%, #0a48bd 100%)", textShadow: "0 1px 0 rgba(0, 0, 0, 0.4)" }}>
          <h1 id="not-found-title" style={{ margin: 0, fontSize: 13 }}>raffi.computer</h1>
        </header>
        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span aria-hidden="true" style={{ flex: "0 0 auto", width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", color: "#ffffff", fontWeight: 700, fontSize: 20, background: "radial-gradient(circle at 35% 30%, #ff8a7a, #d3261a)", border: "1px solid #8f150d", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.5)" }}>×</span>
            <div id="not-found-text" style={{ minWidth: 0, color: "#111827", fontSize: 13, lineHeight: 1.55 }}>
              <p style={{ margin: 0, overflowWrap: "anywhere" }}>
                Windows cannot find <strong data-not-found-path>{path || "that page"}</strong>.
              </p>
              <p style={{ margin: "6px 0 0" }}>The page is missing. The mix isn’t.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={play}
            data-deck={deck}
            aria-label={`${label}: ${mixSelected && currentTrack ? currentTrack.title : mix.title}`}
            className="welcome-deck focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 60, padding: "8px 10px", border: "1px solid #6d7782", borderRadius: 6, background: FACEPLATE, color: "#1d242c", cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.12), 0 2px 0 rgba(20, 30, 45, 0.16)" }}
          >
            <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, padding: "2px 6px", borderRadius: 2, background: "linear-gradient(180deg, #b9c9a3, #a7ba8e)", boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.35)", color: "#1c2a14", fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 700 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-not-found-mix>
                  {`404 · ${mixSelected && currentTrack ? currentTrack.title : mix.title}`}
                </span>
                {deck === "playing" && <span className="welcome-eq" aria-hidden="true"><span /><span /><span /><span /></span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                <span className="welcome-led" aria-hidden="true" />
                {label}
              </span>
            </span>
            <span className="welcome-key" aria-hidden="true" style={{ flex: "0 0 auto", width: 44, height: 44, borderRadius: 5, display: "grid", placeItems: "center", fontSize: 16, color: "#1d242c" }}>
              {deck === "playing" ? "❚❚" : "▶"}
            </span>
          </button>

          <nav aria-label="Ways back" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <a href="/lab/tape-shelf" style={xpButton} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">Tape Shelf</a>
            <a href="/?app=world" style={xpButton} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">Raffi World</a>
            <a href="/" style={{ ...xpButton, fontWeight: 700, boxShadow: "inset 0 0 0 2px #8eb4f5" }} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">Back to the desktop</a>
          </nav>
        </div>
      </section>
    </main>
  )
}
