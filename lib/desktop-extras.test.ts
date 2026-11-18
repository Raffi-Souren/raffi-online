import { test } from "node:test"
import assert from "node:assert/strict"

import { BEST_PREFIX, KONAMI, countTapesFound, konamiStep, readPersonalBests, readWorldProfile } from "./desktop-extras"

function type(keys: readonly string[]) {
  let progress = 0
  let fired = 0
  for (const key of keys) {
    const step = konamiStep(progress, key)
    progress = step.progress
    if (step.done) fired++
  }
  return { progress, fired }
}

test("the Konami code fires once on its last key", () => {
  assert.deepEqual(type(KONAMI), { progress: 0, fired: 1 })
  assert.deepEqual(type(KONAMI.slice(0, -1)), { progress: KONAMI.length - 1, fired: 0 })
  assert.deepEqual(type([...KONAMI, ...KONAMI]), { progress: 0, fired: 2 })
})

test("capital letters count, and a wrong key starts over", () => {
  assert.equal(type([...KONAMI.slice(0, 8), "B", "A"]).fired, 1)
  assert.equal(type([...KONAMI.slice(0, 5), "x", ...KONAMI.slice(5)]).fired, 0)
  assert.equal(type(["a", "b", "Enter", ...KONAMI]).fired, 1)
})

test("extra Ups before the code do not break it", () => {
  assert.equal(type(["ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", ...KONAMI.slice(2)]).fired, 1)
  // An Up in the middle keeps one Up, not the whole run.
  assert.deepEqual(konamiStep(6, "ArrowUp"), { progress: 2, done: false })
  assert.deepEqual(konamiStep(1, "ArrowLeft"), { progress: 0, done: false })
})

const config = { skills: { thresholds: [0, 100, 300, 700, 1500], legs: { name: "Legs" }, wheels: { name: "Wheels" }, board: { name: "Board" }, hustle: { name: "Hustle" } } }

test("a Raffi World profile reads back as cash, skills and wins", () => {
  const raw = JSON.stringify({ version: 1, cash: 81, earned: 105, photos: 2, xp: { legs: 200, wheels: 0, board: 1500, hustle: 50 }, gigs: { "crate-run": { runs: 3, wins: 2, best: 88 }, "flyer-drop": { runs: 1, wins: 1, best: 120 } } })
  const profile = readWorldProfile(raw, config)
  assert.ok(profile)
  assert.equal(profile.cash, 81)
  assert.equal(profile.earned, 105)
  assert.equal(profile.gigsWon, 3)
  assert.equal(profile.photos, 2)
  assert.deepEqual(profile.skills, [
    { id: "legs", name: "Legs", level: 2, fraction: 0.5 },
    { id: "wheels", name: "Wheels", level: 1, fraction: 0 },
    { id: "board", name: "Board", level: 5, fraction: 1 },
    { id: "hustle", name: "Hustle", level: 1, fraction: 0.5 },
  ])
})

test("no profile, a damaged one or a World without street life reads as nothing", () => {
  assert.equal(readWorldProfile(null, config), null)
  assert.equal(readWorldProfile("{oops", config), null)
  assert.equal(readWorldProfile("[]", config), null)
  assert.equal(readWorldProfile(JSON.stringify({ version: 2, cash: 5 }), config), null)
  assert.equal(readWorldProfile(JSON.stringify({ version: 1, cash: 5 }), null), null)
  assert.equal(readWorldProfile(JSON.stringify({ version: 1, cash: 5 }), { skills: { thresholds: [] } }), null)
  // Nonsense numbers are clamped rather than shown.
  const odd = readWorldProfile(JSON.stringify({ version: 1, cash: -40, earned: "lots", xp: { legs: Infinity }, gigs: { a: { wins: -3 }, b: 7 } }), config)
  assert.deepEqual(odd && { cash: odd.cash, earned: odd.earned, gigsWon: odd.gigsWon, legs: odd.skills[0].level }, { cash: 0, earned: 0, gigsWon: 0, legs: 1 })
})

test("found tapes count each known tape once", () => {
  const ids = ["bc-1", "bc-2", "bc-3"]
  assert.equal(countTapesFound('["bc-1","bc-2","bc-1","nope",7]', ids), 2)
  assert.equal(countTapesFound(null, ids), 0)
  assert.equal(countTapesFound("{oops", ids), 0)
  assert.equal(countTapesFound('{"bc-1":true}', ids), 0)
})

function storageOf(entries: Record<string, string>): Pick<Storage, "length" | "key" | "getItem"> {
  const keys = Object.keys(entries)
  return { length: keys.length, key: (index) => keys[index] ?? null, getItem: (key) => entries[key] ?? null }
}

test("personal bests list only real scores, by name", () => {
  const bests = readPersonalBests(storageOf({
    [BEST_PREFIX + "overtime"]: "1200",
    [BEST_PREFIX + "minesweeper-easy"]: "41",
    [BEST_PREFIX + "block-party-brawl"]: "0",
    [BEST_PREFIX + "<script>"]: "9",
    [BEST_PREFIX + "snake"]: "abc",
    "raffi:welcome-dismissed": "1",
  }))
  assert.deepEqual(bests, [
    { id: "minesweeper-easy", label: "Minesweeper Easy", value: 41, unit: "s" },
    { id: "overtime", label: "Overtime", value: 1200, unit: "pts" },
  ])
  assert.deepEqual(readPersonalBests(null), [])
  assert.deepEqual(readPersonalBests({ length: 1, key: () => { throw new Error("blocked") }, getItem: () => null }), [])
})
