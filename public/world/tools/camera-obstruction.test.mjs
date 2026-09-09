import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraBoomFraction } from '../engine/camera-obstruction.js'

const origin = { x: 0, y: 1.5, z: 0 }
const end = { x: 0, y: 4, z: -10 }

test('camera stops in front of a building and includes lens clearance', () => {
  const wall = { type: 'box', x: 0, z: -6, hx: 10, hz: 1, height: 20 }
  assert.ok(Math.abs(cameraBoomFraction(origin, end, [wall]) - 0.468) < 1e-8)
  assert.ok(Math.abs(cameraBoomFraction(origin, end, [wall, { ...wall, z: -3 }]) - 0.168) < 1e-8)
})

test('low props, ramps and buildings outside the boom do not collapse the view', () => {
  const obstacles = [
    { type: 'box', x: 0, z: -6, hx: 10, hz: 1, height: 0.5 },
    { type: 'box', x: 20, z: -6, hx: 2, hz: 1, height: 20 },
    { type: 'ramp', x: 0, z: -3, w: 4, d: 6, h: 2 },
  ]
  assert.equal(cameraBoomFraction(origin, end, obstacles), 1)
})

test('a rotated wall is swept in its local coordinates', () => {
  const angle = Math.PI / 4
  const rotate = (p) => ({ x: -p.z * Math.sin(angle), y: p.y, z: p.z * Math.cos(angle) })
  const c = { type: 'box', ...rotate({ x: 0, y: 0, z: -6 }), hx: 10, hz: 1, height: 20, ry: angle }
  assert.ok(Math.abs(cameraBoomFraction(origin, rotate(end), [c]) - 0.468) < 1e-8)
})

test('circle props and an origin close to a wall cannot be crossed', () => {
  const pole = { type: 'circle', x: 0, z: -5, r: 0.4, height: 6 }
  assert.ok(Math.abs(cameraBoomFraction(origin, end, [pole]) - 0.428) < 1e-8)
  const wall = { type: 'box', x: 0, z: 0, hx: 1, hz: 1, height: 20 }
  assert.equal(cameraBoomFraction(origin, end, [wall]), 0)
  assert.equal(cameraBoomFraction(origin, { ...origin }, []), 1)
})
