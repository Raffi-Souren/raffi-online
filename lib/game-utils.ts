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
export const BRICKBREAKER_LEVELS = [
  { level: 1, name: "Rookie", rows: 4, ballSpeed: 1, requiredScore: 0, multiHitRows: 0 },
  { level: 2, name: "Amateur", rows: 5, ballSpeed: 1.15, requiredScore: 500, multiHitRows: 1 },
  { level: 3, name: "Semi-Pro", rows: 5, ballSpeed: 1.3, requiredScore: 1500, multiHitRows: 2 },
  { level: 4, name: "Professional", rows: 6, ballSpeed: 1.45, requiredScore: 3000, multiHitRows: 2 },
  { level: 5, name: "Expert", rows: 6, ballSpeed: 1.6, requiredScore: 5000, multiHitRows: 3 },
  { level: 6, name: "Master", rows: 7, ballSpeed: 1.75, requiredScore: 8000, multiHitRows: 3 },
  { level: 7, name: "Champion", rows: 7, ballSpeed: 1.9, requiredScore: 12000, multiHitRows: 4 },
  { level: 8, name: "Legend", rows: 8, ballSpeed: 2.0, requiredScore: 17000, multiHitRows: 5 },
]

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
  SOUND_ENABLED: "sound_enabled",
}

// Save game progress to localStorage
export function saveGameProgress(gameName: string, progress: GameProgress): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.PROGRESS + gameName, JSON.stringify(progress))
}

// Load game progress from localStorage
export function loadGameProgress(gameName: string): GameProgress {
  if (typeof window === "undefined") {
    return { currentLevel: 1, unlockedLevels: [1], highScores: {}, totalScore: 0, gamesPlayed: 0 }
  }

  const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS + gameName)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      // Return default if parse fails
    }
  }
  return { currentLevel: 1, unlockedLevels: [1], highScores: {}, totalScore: 0, gamesPlayed: 0 }
}

// Get/set player name
export function getPlayerName(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || ""
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name)
}

// Sound preference
export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED) !== "false"
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled))
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
