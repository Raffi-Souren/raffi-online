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
  { level: 2, name: "Amateur", rows: 4, ballSpeed: 1.05, requiredScore: 500, multiHitRows: 0 },
  { level: 3, name: "Semi-Pro", rows: 5, ballSpeed: 1.1, requiredScore: 1000, multiHitRows: 1 },
  { level: 4, name: "Professional", rows: 5, ballSpeed: 1.15, requiredScore: 1500, multiHitRows: 1 },
  { level: 5, name: "Expert", rows: 5, ballSpeed: 1.2, requiredScore: 2000, multiHitRows: 2 },
  { level: 6, name: "Master", rows: 6, ballSpeed: 1.25, requiredScore: 3000, multiHitRows: 2 },
  { level: 7, name: "Champion", rows: 6, ballSpeed: 1.3, requiredScore: 4000, multiHitRows: 2 },
  { level: 8, name: "Legend", rows: 6, ballSpeed: 1.35, requiredScore: 5000, multiHitRows: 3 },
  { level: 9, name: "Elite", rows: 7, ballSpeed: 1.4, requiredScore: 6500, multiHitRows: 3 },
  { level: 10, name: "The Turn", rows: 7, ballSpeed: 1.45, requiredScore: 8000, multiHitRows: 3 },
  { level: 11, name: "Accelerator", rows: 7, ballSpeed: 1.5, requiredScore: 10000, multiHitRows: 4 },
  { level: 12, name: "Speedster", rows: 7, ballSpeed: 1.55, requiredScore: 12000, multiHitRows: 4 },
  { level: 13, name: "Velocity", rows: 8, ballSpeed: 1.6, requiredScore: 14000, multiHitRows: 4 },
  { level: 14, name: "Hyperdrive", rows: 8, ballSpeed: 1.65, requiredScore: 16500, multiHitRows: 4 },
  { level: 15, name: "Overdrive", rows: 8, ballSpeed: 1.7, requiredScore: 19000, multiHitRows: 5 },
  { level: 16, name: "Turbo", rows: 8, ballSpeed: 1.75, requiredScore: 22000, multiHitRows: 5 },
  { level: 17, name: "Nitro", rows: 8, ballSpeed: 1.8, requiredScore: 25000, multiHitRows: 5 },
  { level: 18, name: "Lightning", rows: 8, ballSpeed: 1.85, requiredScore: 28500, multiHitRows: 5 },
  { level: 19, name: "Thunder", rows: 8, ballSpeed: 1.9, requiredScore: 32000, multiHitRows: 6 },
  { level: 20, name: "Storm", rows: 8, ballSpeed: 1.95, requiredScore: 36000, multiHitRows: 6 },
  { level: 21, name: "Tempest", rows: 8, ballSpeed: 2.0, requiredScore: 40000, multiHitRows: 6 },
  { level: 22, name: "Hurricane", rows: 8, ballSpeed: 2.05, requiredScore: 45000, multiHitRows: 6 },
  { level: 23, name: "Cyclone", rows: 8, ballSpeed: 2.1, requiredScore: 50000, multiHitRows: 7 },
  { level: 24, name: "Typhoon", rows: 8, ballSpeed: 2.15, requiredScore: 55000, multiHitRows: 7 },
  { level: 25, name: "Tornado", rows: 8, ballSpeed: 2.2, requiredScore: 60000, multiHitRows: 7 },
  { level: 26, name: "Whirlwind", rows: 8, ballSpeed: 2.25, requiredScore: 66000, multiHitRows: 7 },
  { level: 27, name: "Vortex", rows: 8, ballSpeed: 2.3, requiredScore: 72000, multiHitRows: 8 },
  { level: 28, name: "Maelstrom", rows: 8, ballSpeed: 2.35, requiredScore: 79000, multiHitRows: 8 },
  { level: 29, name: "Cataclysm", rows: 8, ballSpeed: 2.4, requiredScore: 86000, multiHitRows: 8 },
  { level: 30, name: "Apocalypse", rows: 8, ballSpeed: 2.45, requiredScore: 94000, multiHitRows: 8 },
  { level: 31, name: "Armageddon", rows: 8, ballSpeed: 2.5, requiredScore: 103000, multiHitRows: 8 },
  { level: 32, name: "Infinity", rows: 8, ballSpeed: 2.6, requiredScore: 113000, multiHitRows: 8 },
  { level: 33, name: "Eternity", rows: 8, ballSpeed: 2.7, requiredScore: 124000, multiHitRows: 8 },
  { level: 34, name: "Ultimate", rows: 8, ballSpeed: 2.8, requiredScore: 136000, multiHitRows: 8 },
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
