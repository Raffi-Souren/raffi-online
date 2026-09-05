export const CRATE_QUEST_WIDTH = 28
export const CRATE_QUEST_HEIGHT = 20
export const CRATE_QUEST_SPEED = 3.25
export const CRATE_QUEST_RADIUS = 0.24
export type QuestTile = "paving" | "wood" | "wall" | "shelf" | "table" | "water" | "tree"
export type QuestRecord = "warmup" | "peak" | "closer"
export const QUEST_RECORDS: { id: QuestRecord; title: string; artist: string; role: string; color: string }[] = [
  { id: "warmup", title: "Subway Warmth", artist: "Etta Flux", role: "Warm-up", color: "#f3b35a" },
  { id: "peak", title: "Docks After Dark", artist: "Canal Service", role: "Peak-time", color: "#8db6e0" },
  { id: "closer", title: "Last Train Home", artist: "June Static", role: "Closer", color: "#d5a0c9" },
]
export type QuestEntity = {
  id: string
  x: number
  y: number
  kind: "collector" | "clerk" | "selector" | "crate"
  label: string
  record?: QuestRecord
}
export const QUEST_ENTITIES: QuestEntity[] = [
  { id: "mara", x: 14.5, y: 13.5, kind: "collector", label: "Mara · set curator" },
  { id: "bea", x: 6.5, y: 4.5, kind: "clerk", label: "Bea · Needle & Thread" },
  { id: "milo", x: 20.5, y: 4.5, kind: "selector", label: "Milo · Listening Room" },
  { id: "warmup-bin", x: 4.5, y: 7.5, kind: "crate", label: "Soul & warm-up crate", record: "warmup" },
  { id: "dusty-bin", x: 8.5, y: 7.5, kind: "crate", label: "Sleeves & oddities" },
  { id: "peak-bin", x: 18.5, y: 7.5, kind: "crate", label: "After-hours crate", record: "peak" },
  { id: "yard-bin", x: 23.5, y: 14.5, kind: "crate", label: "Milo's courtyard crate", record: "closer" },
]

function makeMap(): QuestTile[][] {
  const map = Array.from({ length: CRATE_QUEST_HEIGHT }, (_, y) =>
    Array.from(
      { length: CRATE_QUEST_WIDTH },
      (_, x): QuestTile => (y >= 18 ? "water" : x === 0 || x === 27 || y === 0 ? "wall" : "paving"),
    ),
  )
  for (const left of [2, 16]) {
    for (let y = 2; y <= 9; y++)
      for (let x = left; x <= left + 9; x++) {
        map[y][x] = y === 2 || y === 9 || x === left || x === left + 9 ? "wall" : "wood"
      }
    map[9][left + 4] = "wood"
    map[9][left + 5] = "wood"
    for (const x of [left + 1, left + 7]) for (let y = 4; y <= 5; y++) map[y][x] = "shelf"
  }
  for (const [x, y] of [
    [2, 12],
    [3, 15],
    [8, 13],
    [25, 11],
    [21, 16],
  ])
    map[y][x] = "tree"
  for (let x = 12; x <= 16; x++) map[12][x] = "table"
  return map
}
export const QUEST_MAP = makeMap()
export type CrateQuestState = {
  phase: "intro" | "playing" | "dialogue" | "complete"
  player: { x: number; y: number; facing: "up" | "down" | "left" | "right"; stride: number }
  records: QuestRecord[]
  courtyardTip: boolean
  elapsed: number
  dialogue: { speaker: string; text: string; record?: QuestRecord } | null
}
export function createCrateQuest(): CrateQuestState {
  return {
    phase: "intro",
    player: { x: 14.5, y: 16.5, facing: "up", stride: 0 },
    records: [],
    courtyardTip: false,
    elapsed: 0,
    dialogue: null,
  }
}
export function startCrateQuest(state: CrateQuestState) {
  if (state.phase === "intro") state.phase = "playing"
}
const walkable = (x: number, y: number) =>
  ["wood", "paving"].includes(QUEST_MAP[Math.floor(y)]?.[Math.floor(x)] ?? "wall")
export function canWalkCrateQuest(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  const r = CRATE_QUEST_RADIUS
  for (const dx of [-r, r]) for (const dy of [-r, r]) if (!walkable(x + dx, y + dy)) return false
  return QUEST_ENTITIES.every((entity) => Math.hypot(x - entity.x, y - entity.y) >= r + 0.32)
}
export function tickCrateQuest(state: CrateQuestState, seconds: number, horizontal: number, vertical: number) {
  if (state.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return
  const dt = Math.min(seconds, 0.05)
  state.elapsed += dt
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) return
  const magnitude = Math.hypot(horizontal, vertical)
  if (magnitude < 0.01) return
  const dx = (horizontal / Math.max(1, magnitude)) * CRATE_QUEST_SPEED * dt
  const dy = (vertical / Math.max(1, magnitude)) * CRATE_QUEST_SPEED * dt
  state.player.facing =
    Math.abs(horizontal) > Math.abs(vertical) ? (horizontal > 0 ? "right" : "left") : vertical > 0 ? "down" : "up"
  const steps = Math.ceil(Math.hypot(dx, dy) / 0.1)
  const before = { x: state.player.x, y: state.player.y }
  for (let i = 0; i < steps; i++) {
    if (canWalkCrateQuest(state.player.x + dx / steps, state.player.y)) state.player.x += dx / steps
    if (canWalkCrateQuest(state.player.x, state.player.y + dy / steps)) state.player.y += dy / steps
  }
  state.player.stride += Math.hypot(state.player.x - before.x, state.player.y - before.y) * 9
}
export function nearbyQuestEntity(state: CrateQuestState): QuestEntity | undefined {
  if (state.phase !== "playing") return
  return QUEST_ENTITIES.filter((entity) => {
    const distance = Math.hypot(entity.x - state.player.x, entity.y - state.player.y)
    if (distance > 1.4) return false
    for (let t = 0.15; t < 1; t += 0.15) {
      if (!walkable(state.player.x + (entity.x - state.player.x) * t, state.player.y + (entity.y - state.player.y) * t))
        return false
    }
    return true
  }).sort(
    (a, b) =>
      Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y),
  )[0]
}
export function interactCrateQuest(state: CrateQuestState) {
  if (state.phase === "dialogue") {
    state.dialogue = null
    state.phase = "playing"
    return
  }
  const entity = nearbyQuestEntity(state)
  if (!entity) return
  let text: string
  let record: QuestRecord | undefined
  if (entity.kind === "collector") {
    if (state.records.length === QUEST_RECORDS.length) {
      state.phase = "complete"
      return
    }
    text =
      "The courtyard set needs three records: a warm-up, a peak-time cut, and a closer. Dig both shops, ask the selectors, then bring the set back to me. You have " +
      state.records.length +
      " of 3."
  } else if (entity.kind === "clerk") {
    text =
      "Good sets start with space to breathe. Try the soul crate on the left. The right-hand bin is mostly empty sleeves today."
  } else if (entity.kind === "selector") {
    state.courtyardTip = true
    text =
      "There's a peak-time cut in the after-hours bin. For your closer, check my marked crate outside, southeast in the courtyard. Tell it Milo sent you."
  } else if (!entity.record) {
    text = "Old flyers, blank sleeves, and a receipt from 1998. Nothing for this set. Keep digging."
  } else if (state.records.includes(entity.record)) {
    text = "You already packed this record. Leave the other copy for the next digger."
  } else if (entity.record === "closer" && !state.courtyardTip) {
    text = "Reserved for Milo. Ask him in the Listening Room before opening this crate."
  } else {
    record = entity.record
    state.records.push(record)
    const found = QUEST_RECORDS.find((entry) => entry.id === record)!
    text =
      found.title +
      " by " +
      found.artist +
      ". Your " +
      found.role.toLowerCase() +
      " is in the bag. " +
      (state.records.length === 3
        ? "All three found. Bring the set back to Mara in the courtyard."
        : "Keep looking for the rest of the set.")
  }
  state.dialogue = {
    speaker: entity.kind === "crate" ? "In the crate" : entity.label,
    text,
    ...(record ? { record } : {}),
  }
  state.phase = "dialogue"
}
