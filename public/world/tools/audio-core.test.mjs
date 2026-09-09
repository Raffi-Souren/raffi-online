import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { normalizeVolume, stepFootsteps } from '../engine/audio-core.js'
const radio = JSON.parse(fs.readFileSync(new URL('../data/radio.json', import.meta.url), 'utf8'))
const cfg = radio.footsteps

test('volume retains silence, clamps valid numeric changes and ignores missing/corrupt storage', () => {
  assert.equal(normalizeVolume('0'), 0); assert.equal(normalizeVolume(0.37), 0.37)
  assert.equal(normalizeVolume(-4), 0); assert.equal(normalizeVolume(50), 1)
  for (const invalid of [null, undefined, '', ' ', NaN, Infinity, 'oops', false, {}, []]) assert.equal(normalizeVolume(invalid, 0.6), 0.6)
})
test('footsteps follow distance at any render rate, with faster cadence while running', () => {
  const walk = (fps, speed) => {
    let state = null
    for (let i = 0; i <= 8 * fps; i++) state = stepFootsteps(state, { x: i * speed / fps, z: 0, speed }, true, cfg).state
    return state.total
  }
  assert.equal(walk(30, 3.4), walk(60, 3.4)); assert.equal(walk(60, 3.4), walk(144, 3.4))
  assert.ok(walk(60, 6.2) > walk(60, 3.4))
})
test('pause, vehicle travel, standing still and teleporting never synthesize walking steps', () => {
  let result = stepFootsteps(null, { x: 0, z: 0 }, true, cfg)
  result = stepFootsteps(result.state, { x: 200, z: 120 }, true, cfg); assert.equal(result.count, 0)
  result = stepFootsteps(result.state, { x: 202, z: 120 }, false, cfg); assert.equal(result.count, 0)
  result = stepFootsteps(result.state, { x: 202, z: 120 }, true, cfg); assert.equal(result.count, 0)
  result = stepFootsteps(result.state, { x: 203.2, z: 120 }, true, cfg); assert.equal(result.count, 1)
})
test('every authored footstep surface resolves to an original playable instrument', () => {
  for (const surface of [cfg.defaultSurface, ...Object.values(cfg.surfaces)]) {
    const sound = radio.sfx['footstep-' + surface]; assert.ok(sound); assert.ok(sound.decay > 0 && sound.decay < 0.2); assert.ok(sound.gain > 0)
  }
})
