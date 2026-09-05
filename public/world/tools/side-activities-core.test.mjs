import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createSprint, stepSprint, createHandheld, stepHandheld } from '../game/side-activities-core.js'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }
const { buildRoadGraph } = await import('../gen/roads.js')

test('sprint checkpoints follow drivable connected road segments', () => {
  const world = JSON.parse(fs.readFileSync(new URL('../data/world.json', import.meta.url)))
  const graph = buildRoadGraph(world),
    route = world.sideActivities.sprint.route
  for (let i = 0; i < route.length; i++) {
    const a = route[i],
      b = route[(i + 1) % route.length]
    assert.ok(
      graph.edges.some(
        (e) =>
          (e.ax === a.x && e.az === a.z && e.bx === b.x && e.bz === b.z) ||
          (e.bx === a.x && e.bz === a.z && e.ax === b.x && e.az === b.z)
      )
    )
  }
})
test('sprint cannot skip checkpoints, finish on foot, or run after timeout', () => {
  const route = [
      { x: 20, z: 0 },
      { x: 40, z: 0 },
    ],
    run = createSprint(route, 1)
  stepSprint(run, route[1], 0.1, true)
  assert.equal(run.checkpoint, 0)
  stepSprint(run, route[0], 0.1, true)
  assert.equal(run.checkpoint, 1)
  stepSprint(run, route[1], 0.1, true)
  assert.equal(run.status, 'won')
  const stopped = JSON.stringify(run)
  stepSprint(run, route[1], 1, true)
  assert.equal(JSON.stringify(run), stopped)
  const foot = createSprint(route)
  stepSprint(foot, route[0], 0.1, false)
  assert.equal(foot.status, 'lost')
  const late = createSprint(route, 0.1)
  stepSprint(late, route[0], 0.1, true)
  assert.equal(late.status, 'lost')
})
test('handheld can win by steering around real obstacles, and resets cleanly', () => {
  const run = createHandheld()
  run.phase = 'playing'
  for (let i = 0; i < 60 * 61 && run.phase === 'playing'; i++) {
    const closest = [...run.obstacles].sort((a, b) => a.z - b.z)[0]
    const target = closest ? (closest.x > 0 ? -0.7 : 0.7) : 0
    stepHandheld(run, Math.abs(target - run.x) < 0.05 ? 0 : Math.sign(target - run.x), 1 / 60)
  }
  assert.equal(run.phase, 'won')
  assert.ok(run.score >= 500)
  const fresh = createHandheld()
  assert.equal(fresh.score, 0)
  assert.equal(fresh.shield, 3)
})
test('handheld idle play can lose and terminal results freeze', () => {
  const run = createHandheld()
  run.phase = 'playing'
  for (let i = 0; i < 60 * 61 && run.phase === 'playing'; i++) stepHandheld(run, 0, 1 / 60)
  assert.equal(run.phase, 'lost')
  const before = JSON.stringify(run)
  stepHandheld(run, 1, 0.05)
  assert.equal(JSON.stringify(run), before)
})
