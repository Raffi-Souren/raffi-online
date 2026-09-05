import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createSignalState,
  fireSignal,
  SIGNAL_EXIT,
  SIGNAL_MAP,
  signalRay,
  signalWall,
  startSignal,
  stepSignal,
  type SignalInput,
} from "./signal-lost"

const idle: SignalInput = { forward: 0, strafe: 0, turn: 0, sprint: false, fire: false }

test("substation collision and raycasts stop movement and shots at walls", () => {
  const s = createSignalState()
  startSignal(s)
  s.x = 1.3
  s.y = 1.5
  s.angle = Math.PI
  for (let i = 0; i < 120; i++) stepSignal(s, { ...idle, forward: 1 }, 1 / 60)
  assert.ok(s.x >= 1.22)
  assert.ok(signalRay(1.5, 1.5, Math.PI).distance < 0.6)
  s.x = 5.5
  s.y = 3.5
  s.angle = 0
  s.enemies = [{ id: 1, x: 7.5, y: 3.5, hp: 2, charge: 0, cooldown: 0, hit: 0 }]
  assert.equal(fireSignal(s), true)
  assert.equal(s.enemies[0].hp, 2, "blaster passed through the wall")
})

test("pulse blaster hits nearest visible target and respects cadence and heat lock", () => {
  const s = createSignalState()
  startSignal(s)
  s.x = 3.5
  s.y = 10.5
  s.angle = -Math.PI / 2
  s.enemies = [{ id: 1, x: 3.5, y: 8.5, hp: 3, charge: 0.8, cooldown: 0, hit: 0 }]
  assert.equal(fireSignal(s), true)
  assert.equal(s.enemies[0].hp, 2)
  assert.equal(s.enemies[0].charge, 0)
  assert.equal(fireSignal(s), false)
  s.cooldown = 0
  s.heat = 90
  assert.equal(fireSignal(s), true)
  assert.equal(s.overheated, true)
  s.cooldown = 0
  assert.equal(fireSignal(s), false)
  for (let i = 0; i < 150; i++) stepSignal(s, idle, 1 / 60)
  assert.equal(s.overheated, false)
})

test("enemy attacks telegraph before launching dodgeable projectiles", () => {
  const s = createSignalState()
  startSignal(s)
  s.x = 3.5
  s.y = 10.5
  s.enemies = [{ id: 1, x: 3.5, y: 8.5, hp: 2, charge: 0, cooldown: 0, hit: 0 }]
  for (let i = 0; i < 40; i++) stepSignal(s, idle, 1 / 60)
  assert.ok(s.enemies[0].charge > 0.5)
  assert.equal(s.bolts.length, 0)
  for (let i = 0; i < 17; i++) stepSignal(s, idle, 1 / 60)
  assert.equal(s.bolts.length, 1)
  assert.equal(s.health, 100)
  for (let i = 0; i < 35; i++) stepSignal(s, idle, 1 / 60)
  assert.equal(s.health, 86)
})

test("service packs heal once; pause freezes enemies, damage, heat and movement", () => {
  const s = createSignalState()
  startSignal(s)
  s.health = 48
  s.heat = 72
  s.x = 7.5
  s.y = 10.5
  stepSignal(s, idle, 1 / 60)
  assert.equal(s.health, 78)
  assert.equal(s.heat, 0)
  assert.equal(s.pickups[0].active, false)
  stepSignal(s, idle, 1 / 60)
  assert.equal(s.health, 78)
  s.phase = "paused"
  const before = structuredClone(s)
  for (let i = 0; i < 60; i++) stepSignal(s, { ...idle, forward: 1, fire: true }, 1 / 60)
  assert.deepEqual(s, before)
})

function waypoint(x: number, y: number, targetX: number, targetY: number) {
  const width = SIGNAL_MAP[0].length,
    start = Math.floor(y) * width + Math.floor(x),
    goal = Math.floor(targetY) * width + Math.floor(targetX)
  if (start === goal) return { x: targetX, y: targetY }
  const queue = [start],
    previous = new Map<number, number>()
  previous.set(start, start)
  for (let i = 0; i < queue.length && !previous.has(goal); i++) {
    const cell = queue[i],
      cx = cell % width,
      cy = Math.floor(cell / width)
    for (const [nx, ny] of [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ]) {
      const next = ny * width + nx
      if (!signalWall(nx, ny) && !previous.has(next)) {
        previous.set(next, cell)
        queue.push(next)
      }
    }
  }
  assert.ok(previous.has(goal), "objective unreachable")
  let cell = goal
  while (previous.get(cell) !== start) cell = previous.get(cell)!
  return { x: (cell % width) + 0.5, y: Math.floor(cell / width) + 0.5 }
}

test("a player can clear all five sectors and physically reach extraction with real inputs", () => {
  const s = createSignalState()
  startSignal(s)
  const sectors = new Set<number>()
  for (let frame = 0; frame < 60 * 180 && s.phase === "playing"; frame++) {
    sectors.add(s.wave)
    const enemies = s.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))
    const visible = enemies.find(
      (e) => signalRay(s.x, s.y, Math.atan2(e.y - s.y, e.x - s.x)).distance > Math.hypot(e.x - s.x, e.y - s.y) - 0.2,
    )
    if (visible) {
      s.angle = Math.atan2(visible.y - s.y, visible.x - s.x)
      stepSignal(s, { ...idle, fire: true, strafe: Math.sin(frame / 50) > 0 ? 1 : -1 }, 1 / 60)
    } else if (enemies.length || s.wave === 5) {
      const target = enemies[0] || SIGNAL_EXIT,
        point = waypoint(s.x, s.y, target.x, target.y)
      s.angle = Math.atan2(point.y - s.y, point.x - s.x)
      stepSignal(s, { ...idle, forward: 1 }, 1 / 60)
    } else stepSignal(s, idle, 1 / 60)
  }
  assert.deepEqual(Array.from(sectors), [1, 2, 3, 4, 5])
  assert.equal(s.kills, 25)
  assert.equal(s.phase, "won", `run ended ${s.phase} at ${s.x},${s.y}, health ${s.health}, sector ${s.wave}`)
  assert.ok(Math.hypot(s.x - SIGNAL_EXIT.x, s.y - SIGNAL_EXIT.y) < 0.8)
})

test("an undefended player loses; restart creates a clean run", () => {
  const s = createSignalState()
  startSignal(s)
  for (let i = 0; i < 60 * 120 && s.phase === "playing"; i++) stepSignal(s, idle, 1 / 60)
  assert.equal(s.phase, "lost")
  assert.equal(s.health, 0)
  const fresh = createSignalState()
  startSignal(fresh)
  assert.equal(fresh.health, 100)
  assert.equal(fresh.kills, 0)
  assert.equal(fresh.wave, 1)
})

test("a lethal hit ends the frame before a nearby pickup can revive the player", () => {
  const s = createSignalState()
  startSignal(s)
  s.health = 14
  s.pickups = [{ x: s.x, y: s.y, active: true }]
  s.bolts = [{ x: s.x, y: s.y, vx: 0, vy: 0, life: 1 }]
  stepSignal(s, idle, 1 / 60)
  assert.equal(s.phase, "lost")
  assert.equal(s.health, 0)
  assert.equal(s.pickups[0].active, true)
})

test("hidden tapes restore integrity once and reset on a new run", () => {
  const s = createSignalState()
  startSignal(s)
  const tape = s.secrets[0]
  Object.assign(s, { x: tape.x, y: tape.y, health: 30, heat: 90, overheated: true })
  stepSignal(s, idle, 1 / 60)
  assert.equal(tape.found, true)
  assert.equal(s.health, 70)
  assert.equal(s.overheated, false)
  stepSignal(s, idle, 1 / 60)
  assert.equal(s.health, 70)
  assert.equal(
    createSignalState().secrets.some((item) => item.found),
    false,
  )
})
