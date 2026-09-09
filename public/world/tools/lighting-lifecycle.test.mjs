import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1440, height: 900 }
const { createLightSelector } = await import('../engine/render.js')
test('loading an earlier saved clock immediately refreshes nearby lights', () => {
  const select = createLightSelector(), first = { x: 0, z: 0 }, replacement = { x: 1, z: 0 }
  assert.deepEqual(select(100, first, [first]), [first])
  assert.deepEqual(select(5, first, [replacement]), [replacement])
})
test('teleports refresh before the selection timer expires and remote fixtures cost no pool entries', () => {
  const select = createLightSelector(), sources = Array.from({ length: 12 }, (_, i) => ({ x: i * 10, z: 0 }))
  assert.deepEqual(select(1, { x: 0, z: 0 }, sources), sources.slice(0, 6))
  const after = select(1.01, { x: 100, z: 0 }, sources)
  assert.equal(after.length, 6); assert.equal(after[0], sources[10]); assert.ok(after.every(s => Math.abs(s.x - 100) < 65))
  assert.deepEqual(select(1.02, { x: 1000, z: 0 }, sources), [])
})
