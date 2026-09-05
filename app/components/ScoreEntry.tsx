"use client"

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react"
import { getPlayerName, setPlayerName } from "@/lib/game-utils"
import { formatScore, getScoreboard, MAX_PLAYER_NAME, normalizePlayerName } from "@/lib/scoreboards"
import Leaderboard from "./Leaderboard"

interface ScoreEntryProps {
  gameName: string
  score: number
  level?: number
}

const button: CSSProperties = {
  minHeight: 38,
  padding: "7px 11px",
  border: "1px solid #446270",
  borderRadius: 4,
  background: "#24536a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
}

export default function ScoreEntry({ gameName, score, level = 1 }: ScoreEntryProps) {
  const board = getScoreboard(gameName)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    setName(getPlayerName())
  }, [])
  useEffect(() => {
    setSaved(false)
    setSaving(false)
    setError(null)
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [gameName, score, level])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const playerName = normalizePlayerName(name)
    if (!playerName || request.current || saved) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, gameName, score, level }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Couldn't save your result. Try again.")
      if (!controller.signal.aborted) {
        setPlayerName(playerName)
        setName(playerName)
        setSaved(true)
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Couldn't save your result. Try again.")
    } finally {
      if (request.current === controller) {
        request.current = null
        setSaving(false)
      }
    }
  }

  if (!board) return null
  return (
    <section
      aria-label={`${board.name} leaderboard entry`}
      onKeyDown={(event) => {
        if (event.key !== "Tab" && event.key !== "Escape") event.stopPropagation()
      }}
      style={{
        width: "100%",
        marginTop: 14,
        padding: 12,
        boxSizing: "border-box",
        border: "1px solid #a7b7ba",
        borderRadius: 6,
        background: "#edf1e9",
        color: "#263f4b",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 12,
          marginBottom: 9,
        }}
      >
        <strong>{board.label}</strong>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatScore(gameName, score)}
          {board.metric === "points" ? " pts" : ""}
        </span>
      </div>
      {saved ? (
        <p role="status" style={{ margin: "0 0 9px", fontSize: 12 }}>
          Saved. Your best result appears under {name}.
        </p>
      ) : (
        <form onSubmit={save} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          <input
            aria-label="Nickname for leaderboard"
            placeholder="Your nickname"
            autoComplete="nickname"
            value={name}
            maxLength={MAX_PLAYER_NAME}
            onChange={(event) => setName(event.target.value)}
            style={{
              flex: "1 1 125px",
              minWidth: 0,
              width: "100%",
              padding: "8px 9px",
              minHeight: 38,
              boxSizing: "border-box",
              border: "1px solid #899fa5",
              borderRadius: 4,
              background: "#fff",
              color: "#1f3743",
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={saving || !normalizePlayerName(name)}
            style={{ ...button, opacity: saving || !normalizePlayerName(name) ? 0.55 : 1 }}
          >
            {saving ? "Saving…" : "Save result"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" style={{ color: "#922f24", margin: "9px 0", fontSize: 12 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowLeaderboard((show) => !show)}
        style={{ ...button, marginTop: 9, background: "transparent", color: "#24536a" }}
      >
        {showLeaderboard ? "Hide leaderboard" : "View leaderboard"}
      </button>
      {showLeaderboard && (
        <div style={{ marginTop: 10 }}>
          <Leaderboard
            key={`${gameName}-${saved}`}
            gameName={gameName}
            currentScore={score}
            level={board.filterByLevel ? level : undefined}
          />
        </div>
      )}
    </section>
  )
}
