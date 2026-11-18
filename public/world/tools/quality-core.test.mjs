import assert from 'node:assert/strict'
import test from 'node:test'
import { GOVERNOR, TIERS, applyLearnedCeiling, classifyGpu, createGovernor, startPlan, stepGovernor } from '../engine/quality-core.js'

test('GPUs are recognised from what WebGL reports', () => {
  const cases = [
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'software'],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', 'software'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'discrete'],
    ['ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', 'discrete'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)', 'discrete'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', 'apple'],
    ['Apple GPU', 'apple'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'integrated'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', 'integrated'],
    ['', 'unknown'],
  ]
  for (const [name, expected] of cases) assert.equal(classifyGpu(name), expected, name)
  assert.equal(classifyGpu('Apple GPU', { mobile: true }), 'mobile-high')
  assert.equal(classifyGpu('Adreno (TM) 740', { mobile: true }), 'mobile-high')
  assert.equal(classifyGpu('Mali-G57 MC2', { mobile: true }), 'mobile')
  assert.equal(classifyGpu('SwiftShader', { mobile: true }), 'software')
})

test('auto starts high on strong desktops and light on phones and software', () => {
  assert.deepEqual(startPlan('discrete'), { tier: 'high', ceiling: 'ultra' })
  assert.deepEqual(startPlan('software'), { tier: 'performance', ceiling: 'performance' })
  assert.deepEqual(startPlan('mobile'), { tier: 'performance', ceiling: 'balanced' })
  assert.equal(TIERS.indexOf(startPlan('mobile-high').ceiling) < TIERS.indexOf('ultra'), true, 'phones never try Ultra')
  for (const kind of ['software', 'mobile', 'mobile-high', 'discrete', 'apple', 'integrated', 'unknown']) {
    const plan = startPlan(kind)
    assert.ok(TIERS.indexOf(plan.tier) <= TIERS.indexOf(plan.ceiling), kind + ' starts above its ceiling')
  }
})

test('a ceiling learned on an earlier visit holds, and nonsense is ignored', () => {
  assert.deepEqual(applyLearnedCeiling({ tier: 'high', ceiling: 'ultra' }, 'balanced'), { tier: 'balanced', ceiling: 'balanced' })
  assert.deepEqual(applyLearnedCeiling({ tier: 'high', ceiling: 'ultra' }, 'high'), { tier: 'high', ceiling: 'high' })
  // Never raises a plan above what the GPU class allows.
  assert.deepEqual(applyLearnedCeiling({ tier: 'performance', ceiling: 'balanced' }, 'ultra'), { tier: 'performance', ceiling: 'balanced' })
  assert.deepEqual(applyLearnedCeiling({ tier: 'high', ceiling: 'ultra' }, 'cinematic'), { tier: 'high', ceiling: 'ultra' })
  assert.deepEqual(applyLearnedCeiling({ tier: 'high', ceiling: 'ultra' }, null), { tier: 'high', ceiling: 'ultra' })
})

/** Runs the governor at a steady frame time until a change matches `stop` (or 120 s). */
function until(governor, frameMs, clock, stop) {
  const changes = []
  for (let t = 0; t < 120; t += frameMs / 1000) {
    clock.now += frameMs / 1000
    const change = stepGovernor(governor, frameMs, clock.now)
    if (!change) continue
    changes.push({ ...change, at: Math.round(clock.now * 10) / 10 })
    if (stop(change)) break
  }
  return changes
}

/** Runs the governor for `seconds` at a steady frame time; returns every change it asked for. */
function run(governor, frameMs, seconds, clock) {
  const changes = []
  const frames = Math.round((seconds * 1000) / frameMs)
  for (let i = 0; i < frames; i++) {
    clock.now += frameMs / 1000
    const change = stepGovernor(governor, frameMs, clock.now)
    if (change) changes.push({ ...change, at: Math.round(clock.now * 10) / 10 })
  }
  return changes
}

test('slow frames lower the resolution first, then the tier', () => {
  const clock = { now: 0 }
  const governor = createGovernor({ tier: 'high', ceiling: 'ultra' })
  const changes = until(governor, 30, clock, (change) => change.tier)
  assert.deepEqual(changes.slice(0, 3).map((c) => c.scale), [0.9, 0.8, 0.7], 'resolution steps down before anything else')
  assert.ok(changes.slice(0, 3).every((c) => !c.tier))
  assert.deepEqual(changes[3] && { tier: changes[3].tier, scale: changes[3].scale }, { tier: 'balanced', scale: 1 })
  assert.equal(governor.ceiling, 'balanced', 'a tier it fell out of is not tried again')
  // It keeps going down if the device is truly struggling, but never below Performance.
  changes.push(...run(governor, 30, 80, clock))
  assert.equal(governor.tier, 'performance')
  assert.equal(governor.ceiling, 'performance')
  assert.ok(changes.every((c, i) => i === 0 || c.at - changes[i - 1].at >= GOVERNOR.cooldown - 1e-6), 'changes respect the cooldown')
})

test('steady fast frames raise the resolution, then try one tier up', () => {
  const clock = { now: 0 }
  const governor = createGovernor({ tier: 'balanced', ceiling: 'ultra', scale: 0.8 })
  const changes = run(governor, 16.6, 40, clock)
  assert.deepEqual(changes.map((c) => c.tier || c.scale), [0.9, 1, 'high', 'ultra'])
  assert.equal(governor.tier, 'ultra')
  // At the ceiling it holds.
  assert.deepEqual(run(governor, 16.6, 30, clock), [])
})

test('a tier tried that cannot hold goes back at once and is never tried again', () => {
  const clock = { now: 0 }
  const governor = createGovernor({ tier: 'high', ceiling: 'ultra' })
  const up = run(governor, 16.6, 12, clock)
  assert.deepEqual(up.map((c) => c.tier), ['ultra'])
  // Ultra turns out to be too much: frames double, and it goes straight back.
  const back = until(governor, 34, clock, () => true)
  assert.deepEqual(back[0] && { tier: back[0].tier, scale: back[0].scale }, { tier: 'high', scale: 1 })
  assert.ok(back[0].at - up[0].at <= GOVERNOR.probeWindow, 'the probe was undone inside its window')
  assert.equal(governor.ceiling, 'high')
  // Fast again at High: no more probing, no flip-flop.
  assert.deepEqual(run(governor, 16.6, 60, clock), [])
  assert.equal(governor.tier, 'high')
})

test('120 Hz displays count as fast; one long frame does not trigger a change', () => {
  const clock = { now: 0 }
  const governor = createGovernor({ tier: 'balanced', ceiling: 'high' })
  assert.deepEqual(run(governor, 8.3, 12, clock).map((c) => c.tier), ['high'])
  const steady = createGovernor({ tier: 'high', ceiling: 'high' })
  const steadyClock = { now: 0 }
  run(steady, 16.6, 5, steadyClock)
  // A single hitch (a shader compile, a tab switch) is not a trend.
  assert.equal(stepGovernor(steady, 400, steadyClock.now + 0.4), null)
  assert.deepEqual(run(steady, 16.6, 10, steadyClock), [])
  // Nonsense frame times are ignored outright.
  for (const bad of [0, -5, NaN, 5000]) assert.equal(stepGovernor(steady, bad, 100), null)
})
