/**
 * Pure helpers for the desktop's small extras: the Konami code, and what
 * System Properties reads back from this device (Raffi World progress and
 * personal bests). Everything here tolerates missing or damaged storage.
 */

export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"] as const

/** Feeds one key into the Konami matcher. `done` is true on the key that completes it. */
export function konamiStep(progress: number, key: string): { progress: number; done: boolean } {
  const pressed = key.length === 1 ? key.toLowerCase() : key
  if (pressed === KONAMI[progress]) {
    const next = progress + 1
    return next === KONAMI.length ? { progress: 0, done: true } : { progress: next, done: false }
  }
  // A third Up keeps the two already entered; any other miss starts over.
  if (pressed === "ArrowUp") return { progress: progress >= 2 ? 2 : 1, done: false }
  return { progress: 0, done: false }
}

export const WORLD_LIFE_KEY = "raffi-world:life:v1"
export const WORLD_TAPES_KEY = "raffi:tapes-found"
export const BEST_PREFIX = "raffi-best:"

/** The part of Raffi World's data/life.json that the desktop needs. */
export interface WorldLifeConfig {
  skills: { thresholds: number[] } & Record<string, unknown>
}

export interface WorldSkill {
  id: string
  name: string
  level: number
  /** 0–1 progress inside the current level; 1 at the top level. */
  fraction: number
}

export interface WorldProfile {
  cash: number
  earned: number
  gigsWon: number
  photos: number
  skills: WorldSkill[]
}

const SKILL_IDS = ["legs", "wheels", "board", "hustle"] as const
const whole = (value: unknown, max: number) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0)
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)

/**
 * Raffi World's saved street-life profile, or null when there is none (never
 * played, cleared storage, or a World build without street life).
 */
export function readWorldProfile(raw: string | null, config: WorldLifeConfig | null): WorldProfile | null {
  if (!raw || !config) return null
  const thresholds = config.skills?.thresholds
  if (!Array.isArray(thresholds) || thresholds.length < 2 || thresholds.some((value) => typeof value !== "number")) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!isObject(value) || value.version !== 1) return null
  const xp = isObject(value.xp) ? value.xp : {}
  const skills = SKILL_IDS.map((id) => {
    const points = whole(xp[id], 99_999)
    let level = 1
    for (let index = 1; index < thresholds.length; index++) if (points >= thresholds[index]) level = index + 1
    const floor = thresholds[level - 1]
    const next = thresholds[level]
    const info = config.skills[id]
    const name = isObject(info) && typeof info.name === "string" ? info.name : id
    return { id, name, level, fraction: next === undefined ? 1 : Math.max(0, Math.min(1, (points - floor) / (next - floor))) }
  })
  const gigs = isObject(value.gigs) ? Object.values(value.gigs) : []
  return {
    cash: whole(value.cash, 999_999),
    earned: whole(value.earned, 99_999_999),
    gigsWon: gigs.reduce<number>((sum, record) => sum + (isObject(record) ? whole(record.wins, 99_999) : 0), 0),
    photos: whole(value.photos, 99_999),
    skills,
  }
}

/** How many of the known tapes this device has found in Raffi World. */
export function countTapesFound(raw: string | null, validIds: readonly string[]): number {
  if (!raw) return 0
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return 0
    const valid = new Set(validIds)
    return new Set(parsed.filter((id): id is string => typeof id === "string" && valid.has(id))).size
  } catch {
    return 0
  }
}

export interface PersonalBest {
  id: string
  label: string
  value: number
  /** Minesweeper keeps its fastest clear; everything else keeps points. */
  unit: "pts" | "s"
}

/** Every personal best saved on this device, by game name. */
export function readPersonalBests(storage: Pick<Storage, "length" | "key" | "getItem"> | null): PersonalBest[] {
  if (!storage) return []
  const bests: PersonalBest[] = []
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(BEST_PREFIX)) continue
      const value = Number(storage.getItem(key))
      if (!Number.isFinite(value) || value <= 0) continue
      const id = key.slice(BEST_PREFIX.length)
      if (!/^[a-z0-9-]{1,48}$/.test(id)) continue
      const label = id.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
      bests.push({ id, label, value: Math.round(value), unit: id.startsWith("minesweeper") ? "s" : "pts" })
    }
  } catch {
    return []
  }
  return bests.sort((a, b) => a.label.localeCompare(b.label))
}
