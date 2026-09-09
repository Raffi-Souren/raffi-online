import test from 'node:test'
import assert from 'node:assert/strict'
import { createSoccerMatch, stepSoccer, passSoccer, shootSoccer } from '../game/sports-soccer-core.js'
const tick = (s, seconds, input = {}, hz = 120) => { for (let i = 0; i < seconds * hz; i++) stepSoccer(s, 1 / hz, input) }
test('a pass releases a real ball and the teammate receives it while player finds space', () => {
  const s = createSoccerMatch(); tick(s, 1)
  assert.equal(passSoccer(s), true); assert.equal(s.ball.owner, null)
  assert.ok(s.ball.vx > 0); assert.ok(s.ball.vz < 0)
  tick(s, .8, { move: { x: 0, z: -1 } })
  assert.ok(s.completedPasses >= 1); assert.equal(s.ball.owner, 1)
  assert.ok(s.actors[0].z < 2)
})
test('a support teammate seeks a separate forward passing lane', () => {
  const s = createSoccerMatch(); tick(s, 1.4)
  assert.equal(s.ball.owner, 0); assert.ok(s.actors[1].x > 3.4); assert.ok(s.actors[1].z < 2.5)
})
test('spatial shots can score, then award once and reset to the other kickoff', () => {
  const s = createSoccerMatch(); s.phase = 'play'; s.actors[0].x = 1.5; s.actors[0].z = -9; s.actors[2].x = -6; s.actors[3].x = -6
  assert.equal(shootSoccer(s, 0, .6), true); tick(s, .5)
  assert.equal(s.score[0], 1); assert.equal(s.phase, 'kickoff'); assert.equal(s.ball.owner, 2)
  tick(s, .6); assert.equal(s.score[0], 1)
})
test('goal frames reject wide or high shots and keep the loose ball playable', () => {
  for (const [x, y] of [[5, .3], [0, 3]]) { const s = createSoccerMatch(); s.phase = 'play'; Object.assign(s.ball, { owner: null, x, y, z: -11.98, vx: 0, vz: -15, vy: 0 }); stepSoccer(s, 1 / 60); assert.equal(s.score[0], 0); assert.ok(s.ball.vz > 0); assert.ok(s.ball.z > -12) }
})
test('pressing needs proximity and a cooldown, and passive opponents challenge', () => {
  const s = createSoccerMatch(); s.phase = 'play'; s.ball.owner = 2; s.actors[0].x = 0; s.actors[0].z = 5; s.actors[2].x = 0; s.actors[2].z = 4
  stepSoccer(s, 1 / 60, { primaryPressed: true }); assert.equal(s.ball.owner, 0); assert.equal(s.tackles, 1)
  const far = createSoccerMatch(); far.phase = 'play'; far.ball.owner = 2; stepSoccer(far, 1 / 60, { primaryPressed: true }); assert.notEqual(far.ball.owner, 0)
  const idle = createSoccerMatch(); tick(idle, 4); assert.notEqual(idle.ball.owner, 0)
  tick(idle, 2); assert.equal(idle.score[1], 1)
})
test('clock limits a real match, practice continues, zero dt freezes inputs and physics', () => {
  const s = createSoccerMatch({ duration: 2 }); tick(s, 3); assert.equal(s.phase, 'done')
  const p = createSoccerMatch({ mode: 'practice', duration: 2 }); tick(p, 3); assert.equal(p.phase, 'play')
  const before = structuredClone(p); stepSoccer(p, 0, { secondaryPressed: true }); assert.deepEqual(p, before)
})
test('first to three stops scoring and output remains fixed through repeated steps', () => {
  const s = createSoccerMatch(); s.phase = 'play'; s.score[0] = 2; Object.assign(s.ball, { owner: null, x: 0, y: .3, z: -11.99, vx: 0, vz: -10, vy: 0 }); stepSoccer(s, 1 / 60)
  assert.equal(s.phase, 'done'); assert.equal(s.score[0], 3); const before = structuredClone(s); tick(s, 2); assert.deepEqual(s, before)
})
test('fixed-step match agrees at 30, 60 and 120 Hz under real movement', () => {
  const results = [30, 60, 120].map(hz => { const s = createSoccerMatch(); tick(s, 9, { move: { x: .6, z: -.8 } }, hz); return s })
  for (const s of results.slice(1)) { assert.deepEqual(s.score, results[0].score); assert.equal(s.ball.owner, results[0].ball.owner); assert.ok(Math.abs(s.actors[0].x - results[0].actors[0].x) < .001); assert.ok(Math.abs(s.ball.z - results[0].ball.z) < .001) }
})
