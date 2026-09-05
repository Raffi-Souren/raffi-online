import assert from "node:assert/strict"
import test from "node:test"
import {
  formatScore,
  getScoreboard,
  normalizePlayerName,
  parseScoreQuery,
  SCOREBOARD_IDS,
  validateScoreSubmission,
} from "./scoreboards"

const submission = (overrides: Record<string, unknown> = {}) => ({
  playerName: "Raf",
  gameName: "snake",
  score: 100,
  level: 1,
  ...overrides,
})

test("all eight games have an explicit ranking direction and valid result contract", () => {
  assert.equal(SCOREBOARD_IDS.length, 8)
  for (const gameName of SCOREBOARD_IDS) {
    const board = getScoreboard(gameName)!
    assert.equal(board.order, ["borough-gp", "dockyard", "minesweeper"].includes(gameName) ? "asc" : "desc")
    assert.equal(validateScoreSubmission(submission({ gameName, score: 62_345 })).ok, true, gameName)
  }
  for (const gameName of ["unknown", "__proto__", "toString", "constructor", "Snake", ""]) {
    assert.equal(getScoreboard(gameName), undefined)
    assert.equal(validateScoreSubmission(submission({ gameName })).ok, false)
  }
})

test("nickname normalization accepts real names while rejecting blank or invisible submissions", () => {
  assert.equal(normalizePlayerName("  Ｒａｆ  Studio  "), "Raf Studio")
  assert.equal(normalizePlayerName("Zoë O'Neill"), "Zoë O'Neill")
  assert.equal(normalizePlayerName("ラフィ"), "ラフィ")
  assert.equal(normalizePlayerName("Raf 🎮"), "Raf 🎮")
  for (const value of [undefined, 12, {}, "", "   ", "🎮", "---", "Raf\u200b", "Raf\u0000", "a".repeat(25)]) {
    assert.equal(normalizePlayerName(value), null, String(value))
  }
})

test("scores must be finite integers inside the game's metric bounds", () => {
  for (const score of [null, "100", NaN, Infinity, -Infinity, -1, 1.5, 1_000_001, Number.MAX_SAFE_INTEGER]) {
    assert.equal(validateScoreSubmission(submission({ score })).ok, false, String(score))
  }
  assert.equal(validateScoreSubmission(submission({ score: 0 })).ok, true)
  for (const gameName of ["borough-gp", "dockyard", "minesweeper"]) {
    assert.equal(validateScoreSubmission(submission({ gameName, score: 0 })).ok, false)
    assert.equal(validateScoreSubmission(submission({ gameName, score: 1 })).ok, true)
    assert.equal(validateScoreSubmission(submission({ gameName, score: 86_400_000 })).ok, true)
    assert.equal(validateScoreSubmission(submission({ gameName, score: 86_400_001 })).ok, false)
  }
  for (const body of [null, [], "hello", 5]) assert.equal(validateScoreSubmission(body).ok, false)
})

test("levels are bounded by each game and omitted levels retain legacy level one", () => {
  const parsed = validateScoreSubmission(submission({ level: undefined, playerName: "  Raf  " }))
  assert.deepEqual(parsed, { ok: true, value: { gameName: "snake", playerName: "Raf", score: 100, level: 1 } })
  for (const level of [null, "1", 0, -1, 1.5, Infinity, 6])
    assert.equal(validateScoreSubmission(submission({ level })).ok, false)
  assert.equal(validateScoreSubmission(submission({ gameName: "brickbreaker", level: 34 })).ok, true)
  assert.equal(validateScoreSubmission(submission({ gameName: "brickbreaker", level: 35 })).ok, false)
  assert.equal(validateScoreSubmission(submission({ gameName: "signal-lost", level: 3 })).ok, true)
  assert.equal(validateScoreSubmission(submission({ gameName: "minesweeper", level: 2 })).ok, false)
})

test("leaderboard queries reject partial, oversized and unknown query values", () => {
  assert.deepEqual(parseScoreQuery(new URLSearchParams("game=snake")), {
    ok: true,
    value: { gameName: "snake", limit: 10, level: null },
  })
  assert.deepEqual(parseScoreQuery(new URLSearchParams("game=brickbreaker&limit=50&level=34")), {
    ok: true,
    value: { gameName: "brickbreaker", limit: 50, level: 34 },
  })
  for (const limit of ["", "0", "-1", "1.5", "10oops", "51", "1e1", "999999999999999999999"]) {
    assert.equal(parseScoreQuery(new URLSearchParams({ game: "snake", limit })).ok, false, limit)
  }
  for (const level of ["", "0", "-1", "1.5", "1oops", "6"]) {
    assert.equal(parseScoreQuery(new URLSearchParams({ game: "snake", level })).ok, false, level)
  }
  assert.equal(parseScoreQuery(new URLSearchParams("game=constructor")).ok, false)
  assert.equal(parseScoreQuery(new URLSearchParams()).ok, false)
})

test("race results retain milliseconds so adjacent finishes remain distinguishable", () => {
  assert.equal(formatScore("borough-gp", 62_345), "1:02.345")
  assert.equal(formatScore("borough-gp", 62_346), "1:02.346")
  assert.equal(formatScore("minesweeper", 999), "0:00.999")
  assert.equal(formatScore("dockyard", 3_600_001), "60:00.001")
  assert.equal(formatScore("signal-lost", 1234), "1,234")
  assert.equal(formatScore("snake", 0), "0")
})
