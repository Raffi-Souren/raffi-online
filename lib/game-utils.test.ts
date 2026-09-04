import { test } from "node:test"
import assert from "node:assert/strict"
import { getPlayerName, loadGameProgress, saveGameProgress, setPlayerName, type GameProgress } from "./game-utils"

function withStorage(
  storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void },
  run: () => void,
) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage })
  try {
    run()
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
    else Reflect.deleteProperty(globalThis, "window")
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
}

test("blocked browser storage cannot crash game progress or player-name access", () => {
  const unavailable = () => {
    throw new Error("Storage is disabled")
  }
  withStorage({ getItem: unavailable, setItem: unavailable }, () => {
    const progress = loadGameProgress("snake")
    assert.equal(progress.currentLevel, 1)
    assert.deepEqual(progress.unlockedLevels, [1])
    assert.doesNotThrow(() => saveGameProgress("snake", progress))
    assert.equal(getPlayerName(), "")
    assert.doesNotThrow(() => setPlayerName("Player"))
  })
})

test("malformed stored progress falls back to a fresh playable save", () => {
  for (const raw of [
    "{oops",
    "null",
    "42",
    '{"highScores":null}',
    '{"currentLevel":-2,"unlockedLevels":[1],"highScores":{},"totalScore":0,"gamesPlayed":0}',
  ]) {
    withStorage({ getItem: () => raw, setItem: () => {} }, () => {
      const first = loadGameProgress("snake")
      assert.equal(first.currentLevel, 1)
      first.highScores[1] = 999
      assert.deepEqual(loadGameProgress("snake").highScores, {})
    })
  }
})

test("valid progress and player names persist without losing existing level records", () => {
  const values = new Map<string, string>()
  withStorage(
    {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value)
      },
    },
    () => {
      const progress: GameProgress = {
        currentLevel: 2,
        unlockedLevels: [1, 2],
        highScores: { 1: 100, 2: 250 },
        totalScore: 350,
        gamesPlayed: 2,
      }
      saveGameProgress("snake", progress)
      assert.deepEqual(loadGameProgress("snake"), progress)
      setPlayerName("Player")
      assert.equal(getPlayerName(), "Player")
    },
  )
})
