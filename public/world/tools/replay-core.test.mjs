#!/usr/bin/env node
/**
 * Replay core: ring buffer, DAR/TAR, lifecycle math.
 * Mutation: hardcode agreement → named tests fail.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RingBuffer,
  transformCapacity,
  decisionCapacity,
  computeDAR,
  computeTAR,
  computeLiveMetrics,
  agreementPercent,
  formatAgreement,
  shouldSampleTransform,
  snapshotRun,
  pickWeighted,
  makeSeededRng,
} from '../game/replay-core.js'

const CFG = {
  bufferSeconds: 90,
  sampleHz: 10,
  decisionMatchWindow: 1.5,
  pathAgreementRadius: 2.5,
}

test('transformCapacity uses bufferSeconds * sampleHz', () => {
  assert.equal(transformCapacity(CFG), 900)
  assert.equal(transformCapacity({ bufferSeconds: 10, sampleHz: 5 }), 50)
})

test('bounded ring-buffer rollover drops oldest', () => {
  const b = new RingBuffer(3)
  b.push({ t: 1 })
  b.push({ t: 2 })
  b.push({ t: 3 })
  assert.equal(b.size, 3)
  b.push({ t: 4 })
  assert.equal(b.size, 3)
  const arr = b.toArray()
  assert.deepEqual(arr.map((x) => x.t), [2, 3, 4])
})

test('shouldSampleTransform respects sampleHz', () => {
  assert.equal(shouldSampleTransform(null, 0, 10), true)
  assert.equal(shouldSampleTransform(0, 0.05, 10), false)
  assert.equal(shouldSampleTransform(0, 0.1, 10), true)
  assert.equal(shouldSampleTransform(1.0, 1.099, 10), false)
  assert.equal(shouldSampleTransform(1.0, 1.1, 10), true)
})

test('DAR: identical decision streams agree fully', () => {
  const a = [
    { t: 0, actorId: 'n0', verb: 'walk' },
    { t: 1, actorId: 'n0', verb: 'idle' },
    { t: 0.5, actorId: 'n1', verb: 'talk' },
  ]
  const b = a.map((s) => ({ ...s }))
  const r = computeDAR(a, b, 1.5)
  assert.equal(r.compared, 3)
  assert.equal(r.matched, 3)
  assert.equal(r.agreement, 1)
  assert.equal(agreementPercent(r.agreement), 100)
})

test('DAR: differing verbs reduce agreement', () => {
  const a = [
    { t: 0, actorId: 'n0', verb: 'walk' },
    { t: 1, actorId: 'n0', verb: 'idle' },
  ]
  const b = [
    { t: 0, actorId: 'n0', verb: 'walk' },
    { t: 1, actorId: 'n0', verb: 'flee' },
  ]
  const r = computeDAR(a, b, 1.5)
  assert.equal(r.compared, 2)
  assert.equal(r.matched, 1)
  assert.equal(r.agreement, 0.5)
  assert.equal(agreementPercent(r.agreement), 50)
})

test('DAR: missing peer samples do not inflate agreement', () => {
  const a = [
    { t: 0, actorId: 'n0', verb: 'walk' },
    { t: 0, actorId: 'n9', verb: 'idle' }, // no peer in B
  ]
  const b = [{ t: 0, actorId: 'n0', verb: 'walk' }]
  const r = computeDAR(a, b, 1.5)
  assert.equal(r.compared, 1)
  assert.equal(r.matched, 1)
  assert.equal(r.agreement, 1)
})

test('DAR: empty streams unavailable (not 0/100/NaN)', () => {
  const r = computeDAR([], [])
  assert.equal(r.agreement, null)
  assert.equal(agreementPercent(r.agreement), null)
  assert.equal(formatAgreement(null), '--%')
  assert.equal(formatAgreement(agreementPercent(NaN)), '--%')
})

test('TAR: within pathAgreementRadius counts as match', () => {
  const a = [{ t: 0, actorId: 'n0', x: 0, z: 0, yaw: 0 }]
  const b = [{ t: 0, actorId: 'n0', x: 1, z: 1, yaw: 0 }] // dist √2 ≈ 1.41 < 2.5
  const r = computeTAR(a, b, 2.5)
  assert.equal(r.matched, 1)
  assert.equal(r.agreement, 1)
})

test('TAR: beyond tolerance is disagreement', () => {
  const a = [{ t: 0, actorId: 'n0', x: 0, z: 0, yaw: 0 }]
  const b = [{ t: 0, actorId: 'n0', x: 10, z: 0, yaw: 0 }]
  const r = computeTAR(a, b, 2.5)
  assert.equal(r.matched, 0)
  assert.equal(r.compared, 1)
  assert.equal(r.agreement, 0)
  assert.equal(agreementPercent(r.agreement), 0)
})

test('TAR: incomplete streams unavailable', () => {
  const r = computeTAR([{ t: 0, actorId: 'n0', x: 0, z: 0, yaw: 0 }], [])
  assert.equal(r.agreement, null)
})

test('computeLiveMetrics ready only when both metrics exist', () => {
  const runA = {
    decisions: [{ t: 0, actorId: 'n0', verb: 'walk' }],
    transforms: [{ t: 0, actorId: 'n0', x: 0, z: 0, yaw: 0 }],
  }
  const runB = {
    decisions: [{ t: 0, actorId: 'n0', verb: 'walk' }],
    transforms: [{ t: 0, actorId: 'n0', x: 0.5, z: 0, yaw: 0 }],
  }
  const m = computeLiveMetrics(runA, runB, CFG)
  assert.equal(m.ready, true)
  assert.equal(m.darPercent, 100)
  assert.equal(m.tarPercent, 100)
  assert.ok(Number.isFinite(m.darPercent) && Number.isFinite(m.tarPercent))
})

test('same recorded inputs produce expected metric', () => {
  const stream = {
    decisions: [
      { t: 0, actorId: 'a', verb: 'walk' },
      { t: 1, actorId: 'a', verb: 'idle' },
      { t: 0, actorId: 'b', verb: 'talk' },
    ],
    transforms: [
      { t: 0, actorId: 'a', x: 0, z: 0, yaw: 0 },
      { t: 0.1, actorId: 'a', x: 1, z: 0, yaw: 0 },
      { t: 0, actorId: 'b', x: 5, z: 5, yaw: 1 },
    ],
  }
  const m = computeLiveMetrics(stream, structuredClone(stream), CFG)
  assert.equal(m.darPercent, 100)
  assert.equal(m.tarPercent, 100)
})

test('differing real streams alter the metric', () => {
  const runA = {
    decisions: [
      { t: 0, actorId: 'a', verb: 'walk' },
      { t: 1, actorId: 'a', verb: 'idle' },
    ],
    transforms: [
      { t: 0, actorId: 'a', x: 0, z: 0, yaw: 0 },
      { t: 1, actorId: 'a', x: 0, z: 0, yaw: 0 },
    ],
  }
  const runB = {
    decisions: [
      { t: 0, actorId: 'a', verb: 'walk' },
      { t: 1, actorId: 'a', verb: 'flee' },
    ],
    transforms: [
      { t: 0, actorId: 'a', x: 0, z: 0, yaw: 0 },
      { t: 1, actorId: 'a', x: 20, z: 20, yaw: 0 },
    ],
  }
  const m = computeLiveMetrics(runA, runB, CFG)
  assert.ok(m.darPercent < 100, 'DAR must drop when verbs differ')
  assert.ok(m.tarPercent < 100, 'TAR must drop when paths diverge')
})

test('snapshotRun copies buffer contents', () => {
  const d = new RingBuffer(8)
  const t = new RingBuffer(8)
  d.push({ t: 1, actorId: 'a', verb: 'walk' })
  t.push({ t: 1, actorId: 'a', x: 2, z: 3, yaw: 0 })
  const snap = snapshotRun(d, t)
  d.push({ t: 2, actorId: 'a', verb: 'idle' })
  assert.equal(snap.decisions.length, 1)
  assert.equal(snap.transforms[0].x, 2)
})

test('lifecycle clear empties buffers', () => {
  const d = new RingBuffer(4)
  d.push({ t: 1 })
  d.clear()
  assert.equal(d.size, 0)
  assert.deepEqual(d.toArray(), [])
})

test('pickWeighted is deterministic with seeded rng', () => {
  const w = { walk: 5, idle: 1 }
  const a = pickWeighted(w, makeSeededRng(42))
  const b = pickWeighted(w, makeSeededRng(42))
  assert.equal(a, b)
})

// ---- Mutation probes (normally green; flip internals to fail) ----

test('mutation: hardcoded DAR would fail this assertion', () => {
  // Production path: real computeDAR. Mutation would replace agreement with 0.87.
  const r = computeDAR(
    [{ t: 0, actorId: 'n', verb: 'walk' }],
    [{ t: 0, actorId: 'n', verb: 'idle' }],
    1.5,
  )
  // If someone hardcodes DAR to 87%, this fails.
  assert.notEqual(agreementPercent(r.agreement), 87)
  assert.equal(agreementPercent(r.agreement), 0)
})

test('mutation: hardcoded TAR would fail this assertion', () => {
  const r = computeTAR(
    [{ t: 0, actorId: 'n', x: 0, z: 0, yaw: 0 }],
    [{ t: 0, actorId: 'n', x: 100, z: 0, yaw: 0 }],
    2.5,
  )
  assert.notEqual(agreementPercent(r.agreement), 42)
  assert.equal(agreementPercent(r.agreement), 0)
})
