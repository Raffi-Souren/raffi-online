import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  bufferPress, consumeBuffered, createActionBuffer, createLocomotion, movementTuning, stepLocomotion, strideTimeScale, withinCoyote,
} from '../game/locomotion-core.js'

const tuning = movementTuning(JSON.parse(fs.readFileSync(new URL('../data/movement.json', import.meta.url), 'utf8')))
const forward = { x: 0, z: 1, magnitude: 1 }

function timeToReach(hz, fraction) {
  const s = createLocomotion(0)
  const dt = 1 / hz
  for (let t = 0; t < 3; t += dt) {
    stepLocomotion(s, { ...forward, run: true }, dt, tuning)
    if (s.speed >= tuning.runSpeed * fraction) return t + dt
  }
  return Infinity
}

test('a run builds up over about 0.45 s, the same at 30 Hz and 144 Hz', () => {
  const slow = timeToReach(30, 0.95)
  const fast = timeToReach(144, 0.95)
  for (const time of [slow, fast]) assert.ok(time >= 0.4 && time <= 0.55, `0→95% run took ${time.toFixed(3)} s`)
  // A 30 Hz step can only land on a 33 ms boundary; compare the continuous ramp instead.
  const distance = (hz) => {
    const s = createLocomotion(0)
    let z = 0
    for (let i = 0; i < hz; i++) { stepLocomotion(s, { ...forward, run: true }, 1 / hz, tuning); z += s.vz / hz }
    return z
  }
  const d30 = distance(30), d144 = distance(144)
  assert.ok(Math.abs(d30 - d144) / d144 < 0.02, `1 s of running covered ${d30.toFixed(3)} m at 30 Hz vs ${d144.toFixed(3)} m at 144 Hz`)
})

test('a 180° reversal never turns the body faster than the turn-rate cap', () => {
  for (const hz of [30, 60, 144]) {
    const dt = 1 / hz
    const s = createLocomotion(0)
    for (let i = 0; i < hz; i++) stepLocomotion(s, { ...forward, run: true }, dt, tuning)
    const maxStep = tuning.turnRateRunDeg * Math.PI / 180 * dt
    let planted = false
    for (let i = 0; i < hz * 1.5; i++) {
      const before = s.yaw
      stepLocomotion(s, { x: 0, z: -1, magnitude: 1, run: true }, dt, tuning)
      const turned = Math.abs(Math.atan2(Math.sin(s.yaw - before), Math.cos(s.yaw - before)))
      assert.ok(turned <= maxStep + 1e-9, `${hz} Hz: one step turned ${turned.toFixed(4)} rad (cap ${maxStep.toFixed(4)})`)
      planted ||= s.plant > 0
    }
    assert.ok(planted, 'a reversal at run speed plants before pivoting')
    assert.ok(Math.abs(Math.abs(s.yaw) - Math.PI) < 0.02, 'the body finishes facing the new direction')
    assert.ok(s.vz < -tuning.runSpeed * 0.9, 'and runs the new way')
  }
})

test('the body keeps turning the committed way through an exact 180°', () => {
  const s = createLocomotion(0)
  const signs = new Set()
  for (let i = 0; i < 30; i++) {
    const before = s.yaw
    stepLocomotion(s, { x: 0, z: -1, magnitude: 1 }, 1 / 60, tuning)
    const step = Math.atan2(Math.sin(s.yaw - before), Math.cos(s.yaw - before))
    if (Math.abs(step) > 1e-6) signs.add(Math.sign(step))
  }
  assert.equal(signs.size, 1, 'turn direction flip-flopped')
})

test('releasing a run stops within 0.45 s with no residual drift', () => {
  for (const hz of [30, 60, 144]) {
    const dt = 1 / hz
    const s = createLocomotion(0)
    for (let i = 0; i < hz; i++) stepLocomotion(s, { ...forward, run: true }, dt, tuning)
    let stoppedAt = Infinity
    for (let t = 0; t < 1; t += dt) {
      stepLocomotion(s, { x: 0, z: 0, magnitude: 0 }, dt, tuning)
      if (s.speed === 0 && stoppedAt === Infinity) stoppedAt = t + dt
    }
    assert.ok(stoppedAt < 0.45, `${hz} Hz stop took ${stoppedAt.toFixed(3)} s`)
    assert.ok(Math.hypot(s.vx, s.vz) <= 0.01)
  }
})

test('turning and accelerating lean and tip the body within their limits', () => {
  const s = createLocomotion(0)
  let maxLean = 0, maxPitch = 0
  for (let i = 0; i < 60; i++) {
    stepLocomotion(s, { ...forward, run: true }, 1 / 60, tuning)
    maxPitch = Math.max(maxPitch, s.pitch)
  }
  for (let i = 0; i < 60; i++) {
    const angle = i / 60 * Math.PI / 2
    stepLocomotion(s, { x: Math.sin(angle), z: Math.cos(angle), magnitude: 1, run: true }, 1 / 60, tuning)
    maxLean = Math.max(maxLean, Math.abs(s.lean))
  }
  assert.ok(maxPitch > 0 && maxPitch <= tuning.pitchMaxDeg * Math.PI / 180 + 1e-9)
  assert.ok(maxLean > 0.01 && maxLean <= tuning.leanMaxDeg * Math.PI / 180 + 1e-9)
  assert.ok(s.runBlend > 0.9, 'a sustained run blends fully into the run cycle')
})

test('animation rate follows speed inside a stride-matching band', () => {
  assert.equal(strideTimeScale(1.5, 1.5), 1)
  assert.equal(strideTimeScale(0.2, 1.5), 0.7)
  assert.equal(strideTimeScale(9, 3.2), 1.4)
})

test('a press 100 ms before it is legal fires; 150 ms before does not', () => {
  const buffer = createActionBuffer(tuning.inputBufferMs)
  bufferPress(buffer, 10)
  assert.equal(consumeBuffered(buffer, 10.05, false), false)
  assert.equal(consumeBuffered(buffer, 10.1, true), true)
  assert.equal(consumeBuffered(buffer, 10.1, true), false, 'a buffered press fires once')
  bufferPress(buffer, 20)
  assert.equal(consumeBuffered(buffer, 20.15, true), false)
})

test('coyote time allows a hop 90 ms after leaving a lip but not 120 ms', () => {
  assert.equal(withinCoyote(5, 5.09, tuning.coyoteMs), true)
  assert.equal(withinCoyote(5, 5.12, tuning.coyoteMs), false)
  assert.equal(withinCoyote(-Infinity, 5, tuning.coyoteMs), false)
})
