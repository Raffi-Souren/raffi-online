"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw, X } from "lucide-react"
import {
  createCrateQuest,
  interactCrateQuest,
  nearbyQuestEntity,
  QUEST_ENTITIES,
  QUEST_MAP,
  QUEST_RECORDS,
  startCrateQuest,
  tickCrateQuest,
  type CrateQuestState,
  type QuestEntity,
} from "../../lib/crate-quest-engine"

type Props = { onComplete: () => void; onExit: () => void; active?: boolean }
const TILE = 24,
  WIDTH = 480,
  HEIGHT = 336
const ink = "#2d3431",
  cream = "#eee3c5",
  plum = "#674a65",
  gold = "#efb15c"
const button: CSSProperties = {
  font: "inherit",
  fontSize: 12,
  background: cream,
  color: ink,
  border: "2px solid #665d4e",
  borderRadius: 3,
  padding: "8px 12px",
  minHeight: 40,
  cursor: "pointer",
}

function person(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, facing = "down", stride = 0) {
  x = Math.round(x)
  y = Math.round(y)
  ctx.fillStyle = "#273d3440"
  ctx.fillRect(x - 7, y + 4, 14, 5)
  ctx.fillStyle = "#3c3b48"
  ctx.fillRect(x - 5, y, 4, 8 + (Math.sin(stride) > 0 ? 1 : -1))
  ctx.fillRect(x + 1, y, 4, 8 + (Math.sin(stride) < 0 ? 1 : -1))
  ctx.fillStyle = shirt
  ctx.fillRect(x - 6, y - 9, 12, 12)
  ctx.fillStyle = "#ca9770"
  ctx.fillRect(x - 5, y - 18, 10, 10)
  ctx.fillRect(x - 8, y - 7, 2, 7)
  ctx.fillRect(x + 6, y - 7, 2, 7)
  ctx.fillStyle = "#3a3339"
  ctx.fillRect(x - 6, y - 20, 12, 5)
  ctx.fillRect(x - 6, y - 17, 3, 6)
  if (facing !== "up") {
    ctx.fillRect(x + (facing === "left" ? -3 : 2), y - 13, 2, 2)
  }
}

function drawQuest(ctx: CanvasRenderingContext2D, state: CrateQuestState) {
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = "#244943"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const cameraX = Math.round(
    Math.max(0, Math.min(QUEST_MAP[0].length * TILE - WIDTH, state.player.x * TILE - WIDTH / 2)),
  )
  const cameraY = Math.round(
    Math.max(0, Math.min(QUEST_MAP.length * TILE - HEIGHT, state.player.y * TILE - HEIGHT / 2)),
  )
  ctx.save()
  ctx.translate(-cameraX, -cameraY)
  for (let y = 0; y < QUEST_MAP.length; y++)
    for (let x = 0; x < QUEST_MAP[y].length; x++) {
      const px = x * TILE,
        py = y * TILE,
        tile = QUEST_MAP[y][x]
      ctx.fillStyle = tile === "wood" ? "#bfa476" : tile === "water" ? "#467e82" : "#d3c5a0"
      ctx.fillRect(px, py, TILE, TILE)
      if (tile === "wood") {
        ctx.fillStyle = "#a99064"
        ctx.fillRect(px, py + 11, TILE, 1)
        ctx.fillRect(px + (y % 2 ? 6 : 17), py, 1, 11)
      }
      if (tile === "paving") {
        ctx.fillStyle = "#c3b590"
        ctx.fillRect(px, py + 23, TILE, 1)
        ctx.fillRect(px + 23, py, 1, TILE)
        if ((x * 7 + y * 3) % 9 === 0) ctx.fillRect(px + 7, py + 8, 3, 2)
      }
      if (tile === "water") {
        ctx.fillStyle = "#75a49e"
        ctx.fillRect(px + (y % 2 ? 4 : 12), py + 9, 9, 2)
      }
      if (tile === "wall") {
        ctx.fillStyle = "#786761"
        ctx.fillRect(px, py, TILE, TILE)
        ctx.fillStyle = "#a48b76"
        ctx.fillRect(px + 1, py + 2, 22, 7)
        ctx.fillRect(px + 2, py + 13, 9, 7)
        ctx.fillRect(px + 13, py + 13, 10, 7)
        ctx.fillStyle = "#584e4d"
        ctx.fillRect(px, py + 22, TILE, 2)
      }
      if (tile === "shelf") {
        ctx.fillStyle = "#5d4b40"
        ctx.fillRect(px + 2, py + 1, 20, 22)
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = ["#ddad64", "#717e91", "#bb7f67", "#b6b18c", "#9e7d9a"][i]
          ctx.fillRect(px + 4 + i * 3, py + 4, 2, 13)
        }
        ctx.fillStyle = "#a38b5e"
        ctx.fillRect(px + 2, py + 17, 20, 3)
      }
      if (tile === "tree") {
        ctx.fillStyle = "#756046"
        ctx.fillRect(px + 9, py + 13, 6, 11)
        ctx.fillStyle = "#426c53"
        ctx.fillRect(px + 3, py + 2, 18, 17)
        ctx.fillRect(px, py + 7, 24, 8)
        ctx.fillStyle = "#699266"
        ctx.fillRect(px + 4, py + 3, 10, 5)
        ctx.fillRect(px + 1, py + 8, 5, 5)
      }
      if (tile === "table") {
        ctx.fillStyle = "#806847"
        ctx.fillRect(px, py + 2, TILE, 18)
        ctx.fillStyle = "#584a37"
        ctx.fillRect(px + 2, py + 20, 4, 4)
        ctx.fillRect(px + 18, py + 20, 4, 4)
      }
    }
  // Store signs and courtyard furniture are drawn from the same small pixel palette.
  const sign = (x: number, text: string, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x * TILE + 10, 2 * TILE + 4, 220, 17)
    ctx.fillStyle = cream
    ctx.font = "bold 10px monospace"
    ctx.textAlign = "center"
    ctx.fillText(text, x * TILE + 120, 2 * TILE + 16)
  }
  sign(2, "NEEDLE & THREAD", "#79555a")
  sign(16, "THE LISTENING ROOM", "#3e665d")
  ctx.fillStyle = "#98805c"
  ctx.fillRect(12 * TILE, 12 * TILE, 5 * TILE, 12)
  ctx.fillStyle = "#4c5956"
  ctx.fillRect(12 * TILE + 6, 12 * TILE + 3, 31, 7)
  ctx.fillRect(16 * TILE, 12 * TILE + 3, 18, 7)
  ctx.fillStyle = "#674a65"
  ctx.fillRect(12 * TILE + 39, 12 * TILE + 2, 40, 9)
  ctx.font = "9px monospace"
  ctx.textAlign = "center"
  ctx.fillStyle = "#6c6654"
  ctx.fillText("COURTYARD SET", 14.5 * TILE, 15 * TILE)
  const nearby = nearbyQuestEntity(state)
  const actors: (QuestEntity | { id: "player"; kind: "player"; x: number; y: number })[] = [
    ...QUEST_ENTITIES,
    { id: "player", kind: "player", x: state.player.x, y: state.player.y },
  ]
  actors.sort((a, b) => a.y - b.y)
  for (const actor of actors) {
    const x = actor.x * TILE,
      y = actor.y * TILE
    if (actor.kind === "player") person(ctx, x, y, "#cf875f", state.player.facing, state.player.stride)
    else if (actor.kind === "crate") {
      const packed = actor.record && state.records.includes(actor.record)
      const color = QUEST_RECORDS.find((record) => record.id === actor.record)?.color ?? "#a79779"
      ctx.fillStyle = "#806244"
      ctx.fillRect(x - 10, y - 7, 20, 17)
      ctx.fillStyle = "#b08b56"
      ctx.fillRect(x - 10, y + 1, 20, 3)
      ctx.fillRect(x - 10, y + 7, 20, 3)
      ctx.fillStyle = packed ? "#76674f" : color
      ctx.fillRect(x - 7, y - 9, 14, 10)
      if (!packed) {
        ctx.fillStyle = "#39373d"
        ctx.fillRect(x - 3, y - 8, 7, 8)
        ctx.fillStyle = color
        ctx.fillRect(x, y - 5, 2, 2)
      }
    } else person(ctx, x, y, actor.kind === "collector" ? plum : actor.kind === "selector" ? "#548583" : "#b4a259")
    if (actor.id === nearby?.id || (actor.kind === "collector" && state.records.length === 3)) {
      ctx.fillStyle = gold
      ctx.fillRect(x - 5, y - 30, 10, 10)
      ctx.fillStyle = ink
      ctx.font = "bold 8px monospace"
      ctx.textAlign = "center"
      ctx.fillText(actor.id === nearby?.id ? "E" : "!", x, y - 22)
    }
  }
  ctx.restore()
}

export default function CrateQuestGame({ onComplete, onExit, active = true }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef(createCrateQuest())
  const keys = useRef(new Set<string>())
  const completed = useRef(false)
  const [snapshot, setSnapshot] = useState(() => ({ ...game.current }))
  const [paused, setPaused] = useState(false)
  const publish = () =>
    setSnapshot({ ...game.current, player: { ...game.current.player }, records: [...game.current.records] })
  const interact = () => {
    if (active && !paused) {
      interactCrateQuest(game.current)
      keys.current.clear()
      publish()
    }
  }
  const restart = () => {
    game.current = createCrateQuest()
    completed.current = false
    keys.current.clear()
    setPaused(false)
    publish()
  }
  useEffect(() => {
    const heldKeys = keys.current
    if (!active) keys.current.clear()
    const down = (event: KeyboardEvent) => {
      if (!active || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))) return
      if (["Escape", "KeyP"].includes(event.code)) {
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) {
          keys.current.clear()
          setPaused((value) => !value)
        }
        return
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        event.preventDefault()
        keys.current.add(event.code)
      }
      if (["KeyE", "Space"].includes(event.code) && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        if (!event.repeat && !paused) {
          interactCrateQuest(game.current)
          keys.current.clear()
          publish()
        }
      }
    }
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
    }
    const blur = () => {
      keys.current.clear()
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      heldKeys.clear()
    }
  }, [active, paused])
  useEffect(() => {
    const context = canvas.current?.getContext("2d")
    if (!context) return
    if (!active || paused) {
      drawQuest(context, game.current)
      return
    }
    let frame = 0,
      last = 0,
      hudTime = 0
    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      if (active && !paused) {
        const held = (a: string, b: string) => (keys.current.has(a) || keys.current.has(b) ? 1 : 0)
        tickCrateQuest(
          game.current,
          dt,
          held("ArrowRight", "KeyD") - held("ArrowLeft", "KeyA"),
          held("ArrowDown", "KeyS") - held("ArrowUp", "KeyW"),
        )
      }
      drawQuest(context, game.current)
      if (now - hudTime > 100) {
        hudTime = now
        publish()
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [active, paused])
  const target = nearbyQuestEntity(snapshot)
  const collected = snapshot.dialogue?.record && QUEST_RECORDS.find((record) => record.id === snapshot.dialogue?.record)
  const move = (code: string, held: boolean) => {
    if (held && active && !paused) keys.current.add(code)
    else keys.current.delete(code)
  }
  const panel: CSSProperties = {
    background: cream,
    color: ink,
    border: "3px solid #665d4e",
    boxShadow: "5px 5px 0 #172d2c80",
    padding: "18px 20px",
    maxWidth: 420,
    width: "calc(100% - 28px)",
    maxHeight: "calc(100% - 24px)",
    overflowY: "auto",
  }
  return (
    <div
      className="crate-quest"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#29433f",
        fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
        color: ink,
      }}
    >
      <header
        style={{
          background: cream,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderBottom: "3px solid #665d4e",
        }}
      >
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 15, color: plum }}>Crate Quest</strong>
          <div style={{ fontSize: 10 }}>A courtyard set, one record at a time.</div>
        </div>
        <button
          aria-label={paused ? "Resume hunt" : "Pause hunt"}
          style={{ ...button, padding: 8 }}
          onClick={() => {
            keys.current.clear()
            setPaused(!paused)
          }}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button aria-label="Leave hunt" style={{ ...button, padding: 8 }} onClick={onExit}>
          <X size={16} />
        </button>
      </header>
      <div aria-label="Collected set" style={{ display: "flex", gap: 6, padding: "7px 10px", background: "#d9caab" }}>
        {QUEST_RECORDS.map((record) => (
          <div
            key={record.id}
            style={{ flex: 1, minWidth: 0, display: "flex", gap: 5, alignItems: "center", fontSize: 10 }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 13,
                height: 13,
                flexShrink: 0,
                borderRadius: "50%",
                border: "3px solid #3c3b40",
                background: snapshot.records.includes(record.id) ? record.color : "#b3a991",
              }}
            />
            <span>
              {record.role} {snapshot.records.includes(record.id) ? "✓" : "—"}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          tabIndex={0}
          aria-label="Crate Quest record shops. Move with arrows or WASD, interact with E or Space."
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            outlineOffset: -3,
            touchAction: "none",
          }}
        />
        {(snapshot.phase !== "playing" || paused) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#162c2bd4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <section
              aria-label={
                paused
                  ? "Hunt paused"
                  : snapshot.phase === "intro"
                    ? "Crate Quest instructions"
                    : snapshot.phase === "complete"
                      ? "Set complete"
                      : "Collector dialogue"
              }
              style={panel}
            >
              {paused ? (
                <>
                  <h2 style={{ fontSize: 18, marginTop: 0 }}>Need a breather?</h2>
                  <p style={{ fontSize: 12, lineHeight: 1.7 }}>
                    Your records and place in the hunt are saved while this window stays open.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={button} onClick={() => setPaused(false)}>
                      Resume hunt
                    </button>
                    <button style={button} onClick={restart}>
                      <RotateCcw size={12} /> Start over
                    </button>
                    <button style={button} onClick={onExit}>
                      Leave hunt
                    </button>
                  </div>
                </>
              ) : snapshot.phase === "intro" ? (
                <>
                  <h2 style={{ color: plum, fontSize: 21, margin: "0 0 10px" }}>One good set.</h2>
                  <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                    Mara needs a warm-up, a peak-time cut, and a closer for tonight's courtyard session.
                  </p>
                  <p style={{ fontSize: 12, lineHeight: 1.7 }}>
                    Explore the two shops. Talk to the selectors. Dig the crates, then bring all three records back to
                    Mara.
                  </p>
                  <p style={{ fontSize: 11 }}>
                    Arrows / WASD to walk · E / Space to interact
                    <br />
                    Touch: use the pad and Dig / talk button.
                  </p>
                  <button
                    style={{ ...button, background: plum, color: cream }}
                    onClick={() => {
                      startCrateQuest(game.current)
                      publish()
                      canvas.current?.focus()
                    }}
                  >
                    Start digging
                  </button>
                </>
              ) : snapshot.phase === "complete" ? (
                <>
                  <h2 style={{ color: plum, fontSize: 21, margin: "0 0 10px" }}>The set is ready.</h2>
                  <p style={{ fontSize: 12, lineHeight: 1.7 }}>
                    Mara: “Warmth, momentum, and a way home. That's a set with a story.”
                  </p>
                  <ol style={{ paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
                    {QUEST_RECORDS.map((record) => (
                      <li key={record.id}>
                        {record.title}
                        <br />
                        <span style={{ color: "#71604e", fontSize: 10 }}>
                          {record.artist} / {record.role}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <button
                    style={{ ...button, background: plum, color: cream }}
                    onClick={() => {
                      if (!completed.current) {
                        completed.current = true
                        onComplete()
                      }
                    }}
                  >
                    Return to Raffi World
                  </button>
                </>
              ) : (
                <>
                  <div style={{ color: plum, fontSize: 11, marginBottom: 10 }}>{snapshot.dialogue?.speaker}</div>
                  {collected && (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 54,
                        height: 54,
                        float: "right",
                        margin: "0 0 10px 10px",
                        borderRadius: "50%",
                        background: "#34333a",
                        border: "8px double #56545d",
                        boxShadow: "inset 0 0 0 13px #34333a",
                        color: collected.color,
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          background: collected.color,
                          borderRadius: "50%",
                          margin: "13px auto",
                        }}
                      />
                    </div>
                  )}
                  <p style={{ fontSize: 13, lineHeight: 1.75, margin: "0 0 14px" }}>{snapshot.dialogue?.text}</p>
                  <button style={button} onClick={interact}>
                    Continue
                  </button>
                </>
              )}
            </section>
          </div>
        )}
      </div>
      <footer style={{ background: cream, borderTop: "3px solid #665d4e", padding: "8px 12px" }}>
        <div role="status" aria-live="polite" style={{ fontSize: 11, minHeight: 28, marginBottom: 5 }}>
          {snapshot.phase === "complete"
            ? "3 / 3 records · Set assembled"
            : target
              ? target.label + " · E to interact"
              : snapshot.records.length === 3
                ? "3 / 3 records · Return to Mara in the courtyard"
                : snapshot.records.length + " / 3 records · Explore both shops and the courtyard"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 36px)",
              gridTemplateRows: "repeat(2, 32px)",
              gap: 3,
            }}
          >
            {(
              [
                ["ArrowUp", ArrowUp, 2, 1],
                ["ArrowLeft", ArrowLeft, 1, 2],
                ["ArrowDown", ArrowDown, 2, 2],
                ["ArrowRight", ArrowRight, 3, 2],
              ] as const
            ).map(([code, Icon, column, row]) => (
              <button
                key={code}
                aria-label={"Walk " + code.slice(5).toLowerCase()}
                style={{
                  ...button,
                  minHeight: 32,
                  padding: 3,
                  gridColumn: column,
                  gridRow: row,
                  touchAction: "none",
                  userSelect: "none",
                }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  move(code, true)
                }}
                onPointerUp={() => move(code, false)}
                onPointerCancel={() => move(code, false)}
                onLostPointerCapture={() => move(code, false)}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <button
              disabled={
                paused ||
                !active ||
                snapshot.phase === "intro" ||
                snapshot.phase === "complete" ||
                (snapshot.phase === "playing" && !target)
              }
              style={{ ...button, background: gold, minWidth: 105 }}
              onClick={interact}
            >
              {snapshot.phase === "dialogue" ? "Continue" : target?.kind === "crate" ? "Dig crate" : "Talk"}
            </button>
            <div style={{ fontSize: 9, marginTop: 5 }}>WASD / arrows · E to interact · P to pause</div>
          </div>
        </div>
      </footer>
      <style jsx>{`
        .crate-quest button:hover:not(:disabled) {
          filter: brightness(1.07);
        }
        .crate-quest button:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .crate-quest :global(:focus-visible) {
          outline: 3px solid #efb15c;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
