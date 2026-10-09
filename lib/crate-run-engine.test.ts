import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CHECKPOINT_COLUMNS,
  GOAL_COLUMN,
  PLAYER_H,
  TILE,
  crateSizeFor,
  createCrateRun,
  startCrateRun,
  stepCrateRun,
  tileAt,
  type CrateRunInput,
} from "./crate-run-engine"

const DT = 1 / 60
const idle: CrateRunInput = { left: false, right: false, jump: false }

test("waits on the ready card until started", () => {
  const state = createCrateRun()
  stepCrateRun(state, { ...idle, right: true }, DT)
  assert.equal(state.phase, "ready")
  assert.equal(state.player.x, CHECKPOINT_COLUMNS[0] * TILE)
})

test("jumping into a record block empties it and counts the record", () => {
  const state = createCrateRun()
  startCrateRun(state)
  state.player.x = 7 * TILE + 3
  for (let frame = 0; frame < 40; frame++) stepCrateRun(state, { ...idle, jump: frame < 20 }, DT)
  assert.equal(tileAt(state, 7, 5), "U")
  assert.equal(state.records, 1)
})

test("stomping a scratched CD defeats it and bounces the player", () => {
  const state = createCrateRun()
  startCrateRun(state)
  const enemy = state.enemies[0]
  enemy.active = true
  state.player.x = enemy.x + 1
  state.player.y = enemy.y - PLAYER_H - 2
  state.player.vy = 120
  state.player.onGround = false
  stepCrateRun(state, idle, DT)
  assert.equal(enemy.alive, false)
  assert.ok(state.player.vy < 0)
  assert.equal(state.stomps, 1)
})

test("falling into a pit respawns at the last checkpoint", () => {
  const state = createCrateRun()
  startCrateRun(state)
  state.player.x = 28 * TILE + 3
  state.player.y = 8 * TILE
  state.player.onGround = false
  for (let frame = 0; frame < 60; frame++) stepCrateRun(state, idle, DT)
  assert.equal(state.knocks, 1)
  assert.equal(state.player.x, CHECKPOINT_COLUMNS[0] * TILE)
})

test("a scripted run reaches the crate at Raf's Records", () => {
  const state = createCrateRun()
  startCrateRun(state)
  // Hold right and hop every so often; grace frames carry it past any CD it misses.
  for (let frame = 0; frame < 60 * 90 && state.phase === "playing"; frame++) {
    const hop = frame % 34 < 16
    stepCrateRun(state, { left: false, right: true, jump: hop }, DT)
  }
  assert.equal(state.phase, "cleared")
  assert.ok(state.player.x + 10 >= GOAL_COLUMN * TILE)
})

test("crate depth rewards digging on the way", () => {
  assert.equal(crateSizeFor(0), 5)
  assert.equal(crateSizeFor(7), 8)
  assert.equal(crateSizeFor(40), 12)
})
