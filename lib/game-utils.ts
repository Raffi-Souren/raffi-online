// Game utility functions and types

export interface GameLevel {
  level: number
  name: string
  unlocked: boolean
  completed: boolean
  highScore: number
  stars: number // 0-3 stars based on performance
  requiredScore: number // Score needed to unlock
}

export interface GameProgress {
  currentLevel: number
  unlockedLevels: number[]
  highScores: Record<number, number>
  totalScore: number
  gamesPlayed: number
}

export interface GameStats {
  score: number
  level: number
  lives: number
  timeElapsed: number
  isPaused: boolean
  isGameOver: boolean
  isLevelComplete: boolean
}

// Level configurations for each game

export const SNAKE_LEVELS = [
  { level: 1, name: "Slow Start", speed: 120, requiredScore: 0, obstacles: 0 },
  { level: 2, name: "Getting Warm", speed: 100, requiredScore: 100, obstacles: 0 },
  { level: 3, name: "Picking Up", speed: 85, requiredScore: 300, obstacles: 2 },
  { level: 4, name: "Fast Lane", speed: 70, requiredScore: 600, obstacles: 4 },
  { level: 5, name: "Speed Demon", speed: 55, requiredScore: 1000, obstacles: 6 },
]

export const PARACHUTE_LEVELS = [
  { level: 1, name: "Training", heliSpeed: 2, missileSpeed: 3, spawnRate: 2000, requiredScore: 0 },
  { level: 2, name: "Deployment", heliSpeed: 2.5, missileSpeed: 4, spawnRate: 1700, requiredScore: 50 },
  { level: 3, name: "Combat Zone", heliSpeed: 3, missileSpeed: 5, spawnRate: 1400, requiredScore: 150 },
  { level: 4, name: "Hot Zone", heliSpeed: 3.5, missileSpeed: 6, spawnRate: 1100, requiredScore: 300 },
  { level: 5, name: "Warzone", heliSpeed: 4, missileSpeed: 7, spawnRate: 800, requiredScore: 500 },
]

// LocalStorage keys
const STORAGE_KEYS = {
  PROGRESS: "game_progress_",
  PLAYER_NAME: "player_name",
}

// Save game progress to localStorage
export function readGameStorage(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeGameStorage(key: string, value: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Games remain playable without persistent storage. */
  }
}

export function saveGameProgress(gameName: string, progress: GameProgress): void {
  writeGameStorage(STORAGE_KEYS.PROGRESS + gameName, JSON.stringify(progress))
}

// Load game progress from localStorage
export function loadGameProgress(gameName: string): GameProgress {
  const stored = readGameStorage(STORAGE_KEYS.PROGRESS + gameName)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<GameProgress> | null
      if (
        parsed &&
        Number.isInteger(parsed.currentLevel) &&
        (parsed.currentLevel ?? 0) > 0 &&
        Array.isArray(parsed.unlockedLevels) &&
        parsed.unlockedLevels.every((level) => Number.isInteger(level) && level > 0) &&
        parsed.highScores &&
        typeof parsed.highScores === "object" &&
        !Array.isArray(parsed.highScores) &&
        Object.values(parsed.highScores).every((score) => Number.isFinite(score) && score >= 0) &&
        Number.isFinite(parsed.totalScore) &&
        (parsed.totalScore ?? -1) >= 0 &&
        Number.isInteger(parsed.gamesPlayed) &&
        (parsed.gamesPlayed ?? -1) >= 0
      )
        return parsed as GameProgress
    } catch {
      // Return default if parse fails
    }
  }
  return { currentLevel: 1, unlockedLevels: [1], highScores: {}, totalScore: 0, gamesPlayed: 0 }
}

// Get/set player name
export function getPlayerName(): string {
  return readGameStorage(STORAGE_KEYS.PLAYER_NAME) || ""
}

export function setPlayerName(name: string): void {
  writeGameStorage(STORAGE_KEYS.PLAYER_NAME, name)
}

// Calculate stars based on score vs target
export function calculateStars(score: number, targetScore: number): number {
  if (score >= targetScore * 2) return 3
  if (score >= targetScore * 1.5) return 2
  if (score >= targetScore) return 1
  return 0
}

// Format time display
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
