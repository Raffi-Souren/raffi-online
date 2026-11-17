"use client"

import { useEffect, useState, type CSSProperties } from "react"
import WindowShell from "../../components/ui/WindowShell"
import { BADCOMPANY_MIXES } from "@/data/audio-library"
import {
  WORLD_LIFE_KEY, WORLD_TAPES_KEY, countTapesFound, readPersonalBests, readWorldProfile,
  type PersonalBest, type WorldLifeConfig, type WorldProfile,
} from "@/lib/desktop-extras"

interface SystemPropertiesWindowProps {
  isOpen: boolean
  onClose: () => void
  onOpenWindow: (name: string) => void
  /** How many windows are open right now, for the spec sheet. */
  openCount: number
}

const TABS = [
  { id: "general", label: "General" },
  { id: "world", label: "Raffi World" },
  { id: "scores", label: "High scores" },
] as const
type TabId = (typeof TABS)[number]["id"]

const TAHOMA = "Tahoma, Verdana, 'Segoe UI', sans-serif"
const BUILD = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "").slice(0, 7)
const loadedAt = Date.now()

const panel: CSSProperties = { border: "1px solid #919b9c", borderTop: "none", background: "#fbfaf5", padding: 16, minHeight: 250 }
const groupTitle: CSSProperties = { margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#0b2a6f" }
const line: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.6, color: "#1f2937" }
const xpButton: CSSProperties = { minHeight: 44, padding: "0 16px", fontFamily: TAHOMA, fontSize: 13, color: "#111827", background: "linear-gradient(#ffffff, #ece9d8)", border: "1px solid #003c74", borderRadius: 3, cursor: "pointer" }

function uptime(now: number) {
  const minutes = Math.max(0, Math.floor((now - loadedAt) / 60_000))
  if (minutes < 1) return "less than a minute"
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** XP's System Properties, as a spec sheet for this site and what this device has done on it. */
export default function SystemPropertiesWindow({ isOpen, onClose, onOpenWindow, openCount }: SystemPropertiesWindowProps) {
  const [tab, setTab] = useState<TabId>("general")
  const [now, setNow] = useState(loadedAt)
  const [profile, setProfile] = useState<WorldProfile | null>(null)
  const [tapes, setTapes] = useState(0)
  const [bests, setBests] = useState<PersonalBest[]>([])

  useEffect(() => {
    if (!isOpen) return
    setNow(Date.now())
    const clock = window.setInterval(() => setNow(Date.now()), 30_000)
    let cancelled = false
    const read = (config: WorldLifeConfig | null) => {
      if (cancelled) return
      try {
        setTapes(countTapesFound(window.localStorage.getItem(WORLD_TAPES_KEY), BADCOMPANY_MIXES.map((mix) => mix.id)))
        setProfile(readWorldProfile(window.localStorage.getItem(WORLD_LIFE_KEY), config))
        setBests(readPersonalBests(window.localStorage))
      } catch {
        // Storage is blocked: the sheet still opens, with nothing saved to show.
        setTapes(0); setProfile(null); setBests([])
      }
    }
    read(null)
    // Level thresholds and skill names come from the World's own data, so the two never drift.
    fetch("/world/data/life.json").then((response) => (response.ok ? response.json() : null)).then(read).catch(() => read(null))
    return () => { cancelled = true; window.clearInterval(clock) }
  }, [isOpen])

  if (!isOpen) return null

  const select = (id: TabId) => {
    setTab(id)
    window.requestAnimationFrame(() => document.getElementById(`system-tab-${id}`)?.focus({ preventScroll: true }))
  }
  const onTabKey = (event: React.KeyboardEvent) => {
    const index = TABS.findIndex((entry) => entry.id === tab)
    if (event.key === "ArrowRight") { event.preventDefault(); select(TABS[(index + 1) % TABS.length].id) }
    else if (event.key === "ArrowLeft") { event.preventDefault(); select(TABS[(index + TABS.length - 1) % TABS.length].id) }
  }

  return (
    <WindowShell id="system" title="SYSTEM PROPERTIES" onClose={onClose}>
      <div style={{ fontFamily: TAHOMA, color: "#1f2937", background: "#ece9d8", margin: -4, padding: 10, borderRadius: 4 }} data-system-properties>
        <div role="tablist" aria-label="System Properties" onKeyDown={onTabKey} style={{ display: "flex", gap: 2, paddingLeft: 4 }}>
          {TABS.map((entry) => {
            const selected = entry.id === tab
            return (
              <button
                key={entry.id}
                id={`system-tab-${entry.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`system-panel-${entry.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(entry.id)}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                style={{
                  minHeight: 44, padding: "0 14px", fontFamily: TAHOMA, fontSize: 13, cursor: "pointer", color: "#111827",
                  background: selected ? "#fbfaf5" : "linear-gradient(#ffffff, #ece9d8)",
                  border: "1px solid #919b9c", borderBottom: selected ? "1px solid #fbfaf5" : "1px solid #919b9c",
                  borderTop: selected ? "3px solid #e68b2c" : "1px solid #919b9c", borderRadius: "4px 4px 0 0",
                  position: "relative", top: 1, fontWeight: selected ? 700 : 400,
                }}
              >
                {entry.label}
              </button>
            )
          })}
        </div>

        {tab === "general" && (
          <div id="system-panel-general" role="tabpanel" aria-labelledby="system-tab-general" style={panel}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div aria-hidden="true" style={{ flex: "0 0 auto", width: 120, textAlign: "center" }}>
                <div style={{ width: 120, height: 86, borderRadius: 6, border: "3px solid #c9c4b3", background: "linear-gradient(135deg, #3d86f5, #1a55c9 60%, #58b947)", boxShadow: "inset 0 0 0 2px #1d2633, 0 2px 4px #0003" }} />
                <div style={{ width: 44, height: 10, margin: "0 auto", background: "#c9c4b3" }} />
                <div style={{ width: 84, height: 8, margin: "0 auto", borderRadius: 3, background: "#b3ad9a" }} />
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0, display: "grid", gap: 12 }}>
                <section>
                  <h2 style={groupTitle}>System:</h2>
                  <p style={line}>raffi.computer</p>
                  <p style={line}>Raffi OS, XP look</p>
                  <p style={line}>{BUILD ? `Build ${BUILD}` : "Local build"}</p>
                </section>
                <section>
                  <h2 style={groupTitle}>Registered to:</h2>
                  <p style={line}>You, visiting</p>
                </section>
                <section>
                  <h2 style={groupTitle}>Computer:</h2>
                  <p style={line}>Next.js 14 · React 18</p>
                  <p style={line}>three.js r183 graphics</p>
                  <p style={line}>One shared SoundCloud deck</p>
                  <p style={line} data-system-session>{`${openCount} ${openCount === 1 ? "window" : "windows"} open · up ${uptime(now)}`}</p>
                </section>
              </div>
            </div>
            <p style={{ ...line, marginTop: 14, fontSize: 12, color: "#4b5563" }}>Nothing here leaves this device. Scores and World progress are kept in this browser only.</p>
          </div>
        )}

        {tab === "world" && (
          <div id="system-panel-world" role="tabpanel" aria-labelledby="system-tab-world" style={panel}>
            <h2 style={groupTitle}>Raffi World on this device:</h2>
            <p style={line} data-system-tapes>{`${tapes} of ${BADCOMPANY_MIXES.length} tapes found`}</p>
            {profile ? (
              <>
                <p style={line} data-system-cash>{`$${profile.cash.toLocaleString("en-US")} in your pocket · ${profile.gigsWon} ${profile.gigsWon === 1 ? "gig" : "gigs"} finished · ${profile.photos} ${profile.photos === 1 ? "photo" : "photos"}`}</p>
                <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
                  {profile.skills.map((skill) => (
                    <div key={skill.id} role="img" aria-label={`${skill.name} level ${skill.level} of 5`} style={{ display: "grid", gridTemplateColumns: "88px 1fr", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13 }}>{`${skill.name} ${skill.level}`}</span>
                      <span style={{ height: 14, border: "1px solid #7f9db9", background: "#ffffff", borderRadius: 2, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${Math.round(((skill.level - 1 + skill.fraction) / 5) * 100)}%`, background: "repeating-linear-gradient(90deg, #2fbf4a 0 8px, #ffffff 8px 10px)" }} />
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ ...line, margin: "8px 0 12px", color: "#4b5563" }}>
                {tapes > 0 ? "No gigs yet. Open your phone in the World (P) and check Gigs." : "Nothing saved yet. The city keeps what you find and earn on this device."}
              </p>
            )}
            <button type="button" style={xpButton} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" onClick={() => onOpenWindow("world")}>Open Raffi World</button>
          </div>
        )}

        {tab === "scores" && (
          <div id="system-panel-scores" role="tabpanel" aria-labelledby="system-tab-scores" style={panel}>
            <h2 style={groupTitle}>Personal bests on this device:</h2>
            {bests.length ? (
              <table style={{ width: "100%", borderCollapse: "collapse", margin: "4px 0 12px", fontSize: 13 }}>
                <tbody>
                  {bests.map((best) => (
                    <tr key={best.id} style={{ borderBottom: "1px solid #e2dfd2" }}>
                      <th scope="row" style={{ textAlign: "left", fontWeight: 400, padding: "6px 0" }}>{best.label}</th>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", padding: "6px 0" }}>{`${best.value.toLocaleString("en-US")} ${best.unit}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ ...line, margin: "8px 0 12px", color: "#4b5563" }}>Nothing yet. Finish a game and your best stays here.</p>
            )}
            <button type="button" style={xpButton} className="hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" onClick={() => onOpenWindow("games")}>Open Games</button>
          </div>
        )}
      </div>
    </WindowShell>
  )
}
