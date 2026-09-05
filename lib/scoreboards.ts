export const MAX_PLAYER_NAME = 24
export const SCORE_SCHEMA_VERSION = 2
const invisibleCharacters = new RegExp("\\p{C}", "u")
const nameCharacters = new RegExp("[\\p{L}\\p{N}]", "u")

interface Scoreboard {
  name: string
  metric: "points" | "milliseconds"
  order: "asc" | "desc"
  label: string
  maxScore: number
  maxLevel: number
  levelLabel?: string
  filterByLevel?: boolean
}

export const SCOREBOARDS = {
  snake: {
    name: "Snake",
    metric: "points",
    order: "desc",
    label: "High scores",
    maxScore: 1_000_000,
    maxLevel: 5,
    levelLabel: "Level",
  },
  brickbreaker: {
    name: "Brick Breaker",
    metric: "points",
    order: "desc",
    label: "High scores",
    maxScore: 10_000_000,
    maxLevel: 34,
    levelLabel: "Level",
  },
  parachute: {
    name: "Parachute",
    metric: "points",
    order: "desc",
    label: "High scores",
    maxScore: 1_000_000,
    maxLevel: 5,
    levelLabel: "Level",
  },
  "block-party-brawl": {
    name: "Block Party Brawl",
    metric: "points",
    order: "desc",
    label: "High scores",
    maxScore: 100_000,
    maxLevel: 3,
    levelLabel: "Block",
  },
  "borough-gp": {
    name: "Borough Grand Prix",
    metric: "milliseconds",
    order: "asc",
    label: "Fastest races",
    maxScore: 86_400_000,
    maxLevel: 1,
  },
  dockyard: {
    name: "Dockyard",
    metric: "milliseconds",
    order: "asc",
    label: "Fastest victories",
    maxScore: 86_400_000,
    maxLevel: 1,
  },
  minesweeper: {
    name: "Minesweeper",
    metric: "milliseconds",
    order: "asc",
    label: "Fastest clears",
    maxScore: 86_400_000,
    maxLevel: 1,
  },
  "signal-lost": {
    name: "Signal Lost",
    metric: "points",
    order: "desc",
    label: "High scores",
    maxScore: 100_000,
    maxLevel: 3,
    levelLabel: "Sector",
  },
} as const satisfies Record<string, Scoreboard>

export type ScoreboardId = keyof typeof SCOREBOARDS
export const SCOREBOARD_IDS = Object.keys(SCOREBOARDS) as ScoreboardId[]

export function getScoreboard(gameName: string): Scoreboard | undefined {
  return Object.prototype.hasOwnProperty.call(SCOREBOARDS, gameName) ? SCOREBOARDS[gameName as ScoreboardId] : undefined
}

export function formatScore(gameName: string, score: number): string {
  if (getScoreboard(gameName)?.metric !== "milliseconds") return score.toLocaleString("en-US")
  const milliseconds = Math.max(0, Math.round(score))
  const minutes = Math.floor(milliseconds / 60_000)
  const seconds = Math.floor((milliseconds % 60_000) / 1000)
    .toString()
    .padStart(2, "0")
  return `${minutes}:${seconds}.${(milliseconds % 1000).toString().padStart(3, "0")}`
}

export function normalizePlayerName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  if (!name || name.length > MAX_PLAYER_NAME || invisibleCharacters.test(name) || !nameCharacters.test(name))
    return null
  return name
}

type Validation<T> = { ok: true; value: T } | { ok: false; error: string }
export interface ScoreSubmission {
  playerName: string
  gameName: ScoreboardId
  score: number
  level: number
}

export function validateScoreSubmission(body: unknown): Validation<ScoreSubmission> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid score submission." }
  const { playerName, gameName, score, level = 1 } = body as Record<string, unknown>
  const board = typeof gameName === "string" ? getScoreboard(gameName) : undefined
  if (!board) return { ok: false, error: "Unknown game." }
  const name = normalizePlayerName(playerName)
  if (!name)
    return {
      ok: false,
      error: `Use a nickname with 1–${MAX_PLAYER_NAME} characters and at least one letter or number.`,
    }
  if (
    typeof score !== "number" ||
    !Number.isSafeInteger(score) ||
    score < (board.metric === "milliseconds" ? 1 : 0) ||
    score > board.maxScore
  ) {
    return { ok: false, error: "Score is outside this game's valid range." }
  }
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > board.maxLevel) {
    return { ok: false, error: "Invalid level for this game." }
  }
  return { ok: true, value: { playerName: name, gameName: gameName as ScoreboardId, score, level } }
}

export function parseScoreQuery(
  params: URLSearchParams,
): Validation<{ gameName: ScoreboardId; limit: number; level: number | null }> {
  const gameName = params.get("game") || ""
  const board = getScoreboard(gameName)
  if (!board) return { ok: false, error: "Unknown game." }
  const rawLimit = params.get("limit") ?? "10"
  const limit = Number(rawLimit)
  if (!/^[1-9]\d*$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit > 50)
    return { ok: false, error: "Limit must be an integer from 1 to 50." }
  const rawLevel = params.get("level")
  const level = rawLevel === null ? null : Number(rawLevel)
  if (rawLevel !== null && (!/^[1-9]\d*$/.test(rawLevel) || !Number.isInteger(level) || level! > board.maxLevel)) {
    return { ok: false, error: "Invalid level for this game." }
  }
  return { ok: true, value: { gameName: gameName as ScoreboardId, limit, level } }
}
