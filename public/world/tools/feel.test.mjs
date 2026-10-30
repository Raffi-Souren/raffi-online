import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { state } = await import('../engine/state.js')
const { cam, setReducedMotion } = await import('../engine/camera.js')
const { feelCarImpact, feelProp, feelState, resetFeel, setFeelIntensity, updateFeel } = await import('../game/feel.js')

const pole = { type: 'circle', x: 4, z: 2, r: 0.3, tag: 'neon-pole' }

function fresh() {
  resetFeel()
  setReducedMotion(false)
  setFeelIntensity(1)
  cam.shake = 0
}

test('crash feedback still fires after the clock rewinds to an older save', () => {
  fresh()
  state.time = 300
  feelCarImpact(10)
  assert.equal(feelState.lastImpactEvent.time, 300)
  state.time = 40
  feelCarImpact(10)
  assert.equal(feelState.lastImpactEvent.time, 40, 'a stale future stamp silenced the impact')
})

test('a pole hit after a rewind still sways', () => {
  fresh()
  state.time = 300
  feelProp(pole, -1, 0, 3)
  updateFeel(5)
  assert.equal(feelState.wobbles.length, 0, 'the first sway settled')
  state.time = 40
  feelProp(pole, -1, 0, 3)
  assert.equal(feelState.wobbles.length, 1)
})

test('reduced motion keeps the tonk but skips the sway, and stills a running one', () => {
  fresh()
  state.time = 10
  feelProp(pole, -1, 0, 3)
  assert.equal(feelState.wobbles.length, 1)
  setReducedMotion(true)
  updateFeel(1 / 60)
  assert.equal(feelState.wobbles.length, 0, 'turning on reduced motion left a pole swaying')
  state.time = 20
  feelProp(pole, -1, 0, 3)
  assert.equal(feelState.lastPropEvent.time, 20, 'the contact is still recorded for its sound')
  assert.equal(feelState.wobbles.length, 0)
  assert.equal(cam.shake, 0)
})

test('feel intensity scales the sway and zero turns it off', () => {
  fresh()
  state.time = 10
  feelProp(pole, -1, 0, 3)
  const full = feelState.wobbles[0].peak
  resetFeel()
  setFeelIntensity(0.5)
  feelProp(pole, -1, 0, 3)
  assert.ok(Math.abs(feelState.wobbles[0].peak - full / 2) < 1e-12)
  resetFeel()
  setFeelIntensity(0)
  feelProp(pole, -1, 0, 3)
  assert.equal(feelState.wobbles.length, 0)
  setFeelIntensity(1)
})
