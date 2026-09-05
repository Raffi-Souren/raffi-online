"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, Pause, Play, RotateCcw, Zap } from "lucide-react"
import { useWindowActivity } from "../../components/ui/WindowShell"
import { createRace, currentLap, formatRaceTime, racePosition, stepRace, type RaceStatus } from "../../lib/kart-race"
import { createKartScene, trackBend } from "../../lib/kart-scene"
import ScoreEntry from "./ScoreEntry"

type Control = "left" | "right" | "throttle" | "brake" | "drift"
const KEY_CONTROLS: Record<string, Control> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "throttle",
  w: "throttle",
  arrowdown: "brake",
  s: "brake",
  shift: "drift",
  " ": "drift",
}
const shellButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 42,
  padding: "8px 12px",
  border: "1px solid #a5b5bc",
  borderRadius: 6,
  background: "#f8f8ec",
  color: "#243f55",
  boxShadow: "0 2px 0 #a8b6ba",
  fontWeight: 700,
}

export default function KartGame() {
  const { active } = useWindowActivity()
  const hostRef = useRef<HTMLDivElement>(null)
  const raceRef = useRef(createRace())
  const runId = useRef(0)
  const keysRef = useRef(new Set<string>())
  const touchRef = useRef(new Set<Control>())
  const activeRef = useRef(active)
  const resumeStatus = useRef<RaceStatus>("racing")
  const [status, setStatus] = useState<RaceStatus>("ready")
  const [error, setError] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const [held, setHeld] = useState<Control[]>([])
  const [hud, setHud] = useState({
    lap: 1,
    position: 6,
    speed: 0,
    time: "0:00.00",
    boost: 0,
    drift: 0,
    countdown: 3,
    pickups: 0,
  })
  const [map, setMap] = useState({ points: "", x: 50, y: 86, rivals: [] as { x: number; y: number }[] })

  const clearControls = useCallback(() => {
    keysRef.current.clear()
    touchRef.current.clear()
    setHeld([])
  }, [])

  const pause = useCallback(() => {
    const race = raceRef.current
    if (race.status !== "racing" && race.status !== "countdown") return
    resumeStatus.current = race.status
    race.status = "paused"
    setStatus("paused")
    clearControls()
  }, [clearControls])

  const start = useCallback(() => {
    clearControls()
    runId.current++
    raceRef.current = createRace()
    raceRef.current.status = "countdown"
    setStatus("countdown")
  }, [clearControls])

  const resume = useCallback(() => {
    raceRef.current.status = resumeStatus.current
    setStatus(resumeStatus.current)
  }, [])

  useEffect(() => {
    activeRef.current = active
    if (!active) pause()
  }, [active, pause])

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("raffi-borough-gp-best"))
      if (Number.isFinite(stored) && stored > 0) setBest(stored)
    } catch {
      /* Racing also works when browser storage is unavailable. */
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const keys = keysRef.current
    const touch = touchRef.current
    let scene: ReturnType<typeof createKartScene>
    try {
      scene = createKartScene(host)
    } catch {
      setError(true)
      return
    }
    setMap((previous) => ({ ...previous, points: scene.mapPoints }))
    let frame = 0
    let previousTime = 0
    let previousHud = 0
    let previousStatus: RaceStatus = "ready"
    let savedFinish = false
    const animate = (timestamp: number) => {
      const dt = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.05) : 1 / 60
      previousTime = timestamp
      const race = raceRef.current
      const pressed = (control: Control) =>
        touchRef.current.has(control) || Array.from(keysRef.current).some((key) => KEY_CONTROLS[key] === control)
      const steer = Number(pressed("right")) - Number(pressed("left"))
      if (activeRef.current) {
        stepRace(
          race,
          {
            steer,
            throttle: pressed("throttle"),
            brake: pressed("brake"),
            drift: pressed("drift"),
            bend: trackBend(race.distance),
          },
          dt,
        )
        scene.render(race, dt, steer)
      }
      if (race.status !== previousStatus) {
        setStatus(race.status)
        previousStatus = race.status
      }
      if (race.status === "finished" && !savedFinish) {
        savedFinish = true
        clearControls()
        setBest((previous) => {
          const next = previous === null ? race.elapsed : Math.min(previous, race.elapsed)
          try {
            localStorage.setItem("raffi-borough-gp-best", String(next))
          } catch {
            /* Optional personal record. */
          }
          return next
        })
      }
      if (race.status !== "finished") savedFinish = false
      if (timestamp - previousHud > 80) {
        previousHud = timestamp
        setHud({
          lap: currentLap(race),
          position: racePosition(race),
          speed: Math.round(race.speed * 2.4),
          time: formatRaceTime(race.elapsed),
          boost: race.boost,
          drift: race.driftCharge,
          countdown: Math.max(1, Math.ceil(race.countdown)),
          pickups: race.pickups,
        })
        const point = scene.mapPosition(race.distance)
        setMap((previous) => ({
          ...previous,
          ...point,
          rivals: race.rivals.map((rival) => scene.mapPosition(rival.distance)),
        }))
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !activeRef.current ||
        (event.target instanceof HTMLElement &&
          (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable))
      )
        return
      const key = event.key.toLowerCase()
      if ((key === "p" || key === "escape") && !event.repeat) {
        event.preventDefault()
        if (raceRef.current.status === "paused") resume()
        else pause()
      } else if (key === "r" && !event.repeat) {
        start()
      } else if (KEY_CONTROLS[key] && (raceRef.current.status === "racing" || raceRef.current.status === "countdown")) {
        if (key === " " && event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        keysRef.current.add(key)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase())
    }
    const onVisibility = () => {
      if (document.hidden) pause()
    }
    const onBlur = () => {
      clearControls()
      pause()
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      pause()
      setError(true)
    }
    const canvas = host.querySelector("canvas")
    canvas?.addEventListener("webglcontextlost", onContextLost)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("visibilitychange", onVisibility)
      canvas?.removeEventListener("webglcontextlost", onContextLost)
      keys.clear()
      touch.clear()
      scene.dispose()
    }
  }, [clearControls, pause, resume, start])

  const touchButton = (control: Control, label: string, icon: React.ReactNode, accent = false) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={held.includes(control)}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:translate-y-px"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        touchRef.current.add(control)
        setHeld(Array.from(touchRef.current))
      }}
      onPointerUp={() => {
        touchRef.current.delete(control)
        setHeld(Array.from(touchRef.current))
      }}
      onPointerCancel={() => {
        touchRef.current.delete(control)
        setHeld(Array.from(touchRef.current))
      }}
      onLostPointerCapture={() => {
        touchRef.current.delete(control)
        setHeld(Array.from(touchRef.current))
      }}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault()
          touchRef.current.add(control)
          setHeld(Array.from(touchRef.current))
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          touchRef.current.delete(control)
          setHeld(Array.from(touchRef.current))
        }
      }}
      onBlur={() => {
        touchRef.current.delete(control)
        setHeld(Array.from(touchRef.current))
      }}
      style={{
        ...shellButton,
        flex: accent ? "1.4 1 0" : "1 1 0",
        minWidth: 0,
        padding: "10px 3px",
        minHeight: 48,
        touchAction: "none",
        userSelect: "none",
        background: held.includes(control) ? "#bacbd1" : accent ? "#f3b95d" : "#f7f7ec",
        borderColor: accent ? "#c79449" : "#a5b5bc",
        fontSize: 12,
      }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )

  const overlay = status === "ready" || status === "paused" || status === "finished"
  return (
    <section
      aria-label="Borough Grand Prix racing game"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 350,
        background: "#dce5e4",
        color: "#243f55",
        fontFamily: "'Trebuchet MS', Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "7px 12px",
          background: "#e8eddf",
          borderBottom: "2px solid #a8b8bc",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 15 }}>
          Borough Grand Prix{" "}
          <span className="hidden sm:inline" style={{ fontWeight: 400, fontSize: 12 }}>
            {" "}
            / East River circuit
          </span>
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={status === "paused" ? resume : pause}
            disabled={status === "ready" || status === "finished"}
            aria-label={status === "paused" ? "Resume race" : "Pause race"}
            style={{
              ...shellButton,
              minHeight: 34,
              padding: "5px 9px",
              opacity: status === "ready" || status === "finished" ? 0.45 : 1,
            }}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            {status === "paused" ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            type="button"
            onClick={start}
            aria-label="Restart race"
            style={{ ...shellButton, minHeight: 34, padding: "5px 9px" }}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div
        style={{ position: "relative", flex: "1 1 auto", minHeight: 210, overflow: "hidden", background: "#b9ddec" }}
      >
        <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "absolute",
            inset: "12px 12px auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "7px 12px",
              borderRadius: 7,
              background: "#f8f4e5ed",
              boxShadow: "0 3px 0 #24485b30",
              display: "flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            <strong style={{ fontSize: 32, fontStyle: "italic", lineHeight: 1 }}>{hud.position}</strong>
            <span style={{ fontSize: 13 }}> / 6</span>
          </div>
          <div
            style={{
              padding: "7px 10px",
              borderRadius: 7,
              background: "#f8f4e5ed",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              fontSize: 12,
            }}
          >
            <strong>Lap {hud.lap} / 3</strong>
            <div>{hud.time}</div>
          </div>
        </div>
        <svg
          viewBox="0 0 100 100"
          aria-label="Circuit map"
          style={{
            position: "absolute",
            width: "clamp(72px, 14vw, 112px)",
            height: "clamp(72px, 14vw, 112px)",
            left: 10,
            bottom: 10,
            opacity: overlay ? 0.3 : 1,
            filter: "drop-shadow(0 2px 2px #193c5960)",
          }}
        >
          <polyline points={map.points} fill="none" stroke="#f7f1de" strokeWidth={5} strokeLinejoin="round" />
          <polyline points={map.points} fill="none" stroke="#516a7b" strokeWidth={2} />
          {map.rivals.map((rival, i) => (
            <circle key={i} cx={rival.x} cy={rival.y} r={2.2} fill="#ec9468" />
          ))}
          <circle cx={map.x} cy={map.y} r={3.6} fill="#42d0db" stroke="#234253" strokeWidth={1.5} />
        </svg>
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            textAlign: "right",
            color: "#fff9e5",
            textShadow: "0 2px 4px #1c4058",
          }}
        >
          <strong style={{ fontSize: 34, fontStyle: "italic", lineHeight: 1 }}>{hud.speed}</strong>
          <span style={{ fontSize: 11 }}> km/h</span>
          <div style={{ marginTop: 4, fontWeight: 800, fontSize: 12 }}>
            {hud.boost > 0
              ? "Boost!"
              : hud.drift >= 0.65
                ? "Release drift for boost"
                : hud.drift > 0
                  ? "Hold that drift…"
                  : `${hud.pickups} records collected`}
          </div>
          <div
            role="meter"
            aria-label="Drift charge"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((hud.drift / 1.6) * 100)}
            style={{
              width: 116,
              height: 6,
              background: "#23495b80",
              borderRadius: 3,
              marginTop: 5,
              marginLeft: "auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(100, hud.boost > 0 ? 100 : (hud.drift / 1.6) * 100)}%`,
                height: "100%",
                background: hud.boost > 0 ? "#55e4ed" : "#ffc768",
              }}
            />
          </div>
        </div>

        {status === "countdown" && (
          <div
            role="status"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeContent: "center",
              textAlign: "center",
              pointerEvents: "none",
              color: "#fff6d5",
              textShadow: "0 4px 0 #284c68",
            }}
          >
            <strong style={{ fontSize: 92, lineHeight: 1 }}>{hud.countdown}</strong>
            <span style={{ fontWeight: 700, marginTop: 12 }}>Hold the gas. Find your line.</span>
          </div>
        )}
        {overlay && !error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: status === "finished" ? "block" : "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 14,
              background: "#24435740",
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            <div
              style={{
                width: "min(100%, 390px)",
                margin: status === "finished" ? "0 auto" : "auto",
                padding: "clamp(14px, 3vw, 26px)",
                background: "#faf5e6",
                border: "3px solid #f1b859",
                borderRadius: 12,
                boxShadow: "0 8px 0 #25475c50",
                textAlign: "center",
              }}
            >
              <Flag size={25} style={{ margin: "0 auto 8px", color: "#bd654b" }} />
              <h2
                style={{
                  fontWeight: 900,
                  fontSize: "clamp(24px, 4vw, 34px)",
                  lineHeight: 1.03,
                  margin: "0 0 10px",
                  letterSpacing: "-1px",
                }}
              >
                {status === "ready"
                  ? "Take the long way home."
                  : status === "paused"
                    ? "Pit stop."
                    : hud.position === 1
                      ? "The borough is yours."
                      : `Finished ${hud.position}${hud.position === 2 ? "nd" : hud.position === 3 ? "rd" : "th"}.`}
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>
                {status === "ready"
                  ? "Three laps along the waterfront. Five rivals. A trunk full of records."
                  : status === "paused"
                    ? "Your race is right where you left it."
                    : `${formatRaceTime(raceRef.current.elapsed)} · ${raceRef.current.pickups} records collected`}
              </p>
              {status === "ready" && (
                <div
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    padding: "10px 12px",
                    background: "#e6eadd",
                    borderRadius: 5,
                    marginBottom: 15,
                    lineHeight: 1.8,
                  }}
                >
                  <div>
                    <strong>↑ / W</strong> gas &nbsp; <strong>↓ / S</strong> brake &nbsp; <strong>← → / A D</strong>{" "}
                    steer
                  </div>
                  <div>
                    <strong>Shift + steer</strong> to drift. Release for a boost.
                  </div>
                  <div>Pick up gold record crates for extra speed.</div>
                  <div style={{ color: "#496071" }}>Touch controls below. P pauses; R restarts.</div>
                </div>
              )}
              {status === "finished" && (
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11, marginBottom: 15 }}>
                  {raceRef.current.lapTimes.map((time, i) => (
                    <span key={i}>
                      Lap {i + 1}
                      <br />
                      <strong>{formatRaceTime(time)}</strong>
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={status === "paused" ? resume : start}
                style={{
                  ...shellButton,
                  background: "#27677d",
                  color: "#fff5df",
                  borderColor: "#194b61",
                  boxShadow: "0 3px 0 #163f54",
                  padding: "12px 26px",
                  minHeight: 46,
                }}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
              >
                <Play size={17} fill="currentColor" />
                {status === "ready" ? "Start race" : status === "paused" ? "Back to the race" : "Race again"}
              </button>
              {best !== null && (
                <p style={{ fontSize: 11, margin: "12px 0 0", color: "#5d6e76" }}>
                  Your best race: {formatRaceTime(best)}
                </p>
              )}
              {status === "finished" && (
                <div style={{ marginTop: 16 }}>
                  <ScoreEntry
                    key={`borough-gp-${runId.current}`}
                    gameName="borough-gp"
                    score={Math.round(raceRef.current.elapsed * 1000)}
                    level={1}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeContent: "center",
              padding: 24,
              background: "#f5f0df",
              textAlign: "center",
            }}
          >
            <strong>The track needs WebGL.</strong>
            <p style={{ fontSize: 14, maxWidth: 320 }}>
              Enable graphics acceleration in your browser, then close and reopen this game.
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 7,
          padding: "10px 12px 12px",
          background: "#e8eddf",
          borderTop: "2px solid #a8b8bc",
          flexShrink: 0,
        }}
      >
        {touchButton("left", "Steer left", <ArrowLeft size={20} />)}
        {touchButton("right", "Steer right", <ArrowRight size={20} />)}
        {touchButton("drift", "Drift", <Zap size={19} />)}
        {touchButton("brake", "Brake", <ArrowDown size={20} />)}
        {touchButton("throttle", "Gas", <ArrowUp size={20} />, true)}
      </div>
      <span role="status" className="sr-only">
        {status === "finished"
          ? `Race finished in position ${hud.position} of six.`
          : status === "paused"
            ? "Race paused."
            : status === "racing"
              ? "Go! Race started."
              : ""}
      </span>
    </section>
  )
}
