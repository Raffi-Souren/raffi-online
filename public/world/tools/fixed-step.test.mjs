import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createFixedClock, interpolatePlayer } from '../engine/fixed-step.js'
import { createRenderPoses } from '../engine/render-poses.js'

test('30/60/120Hz rendering advances identical sixty-hertz motion and mission time', () => {
  for (const frames of [30, 60, 120]) {
    const clock = createFixedClock()
    let position = 0, time = 0, ticks = 0
    for (let i = 0; i < frames * 10; i++) clock.advance(1 / frames, dt => { position += 6 * dt; time += dt; ticks++ })
    assert.equal(ticks, 600)
    assert.ok(Math.abs(position - 60) < 1e-9)
    assert.ok(Math.abs(time - 10) < 1e-9)
  }
})
test('stalls are bounded and hidden/pause resets never fast-forward an old frame', () => {
  const clock = createFixedClock()
  const result = clock.advance(12, () => {})
  assert.equal(result.steps, 8)
  assert.ok(result.droppedSeconds > 11)
  for (const bad of [NaN, Infinity, -10]) assert.equal(clock.advance(bad, () => {}).steps, 0)
  clock.advance(1 / 120, () => {})
  clock.reset()
  assert.equal(clock.advance(1 / 120, () => {}).steps, 0)
  assert.equal(clock.advance(0.1, () => false).steps, 1)
})
test('interpolation follows the short yaw arc and snaps teleports', () => {
  const old = { x: 0, y: 0, z: 0, yaw: Math.PI - 0.1 }
  const next = { x: 2, y: 0.2, z: 4, yaw: -Math.PI + 0.1 }
  const middle = interpolatePlayer(old, next, 0.5)
  assert.deepEqual([middle.x, middle.y, middle.z], [1, 0.1, 2])
  assert.ok(Math.abs(middle.yaw - Math.PI) < 1e-10)
  assert.deepEqual(interpolatePlayer(old, { ...next, x: 600 }, 0.1), { ...next, x: 600 })
})
test('actor interpolation cannot leak positions into collisions, saves or later ticks', () => {
  const scene = new THREE.Scene(), actor = new THREE.Group(), building = new THREE.Group()
  actor.name = 'player'
  scene.add(actor, building)
  const poses = createRenderPoses()
  poses.capture(scene)
  actor.position.set(2, 0, 4); actor.rotation.y = Math.PI / 2
  building.position.x = 10
  poses.apply(0.5)
  assert.deepEqual(actor.position.toArray(), [1, 0, 2])
  assert.ok(Math.abs(actor.rotation.y - Math.PI / 4) < 1e-9)
  assert.equal(building.position.x, 10)
  poses.restore()
  assert.deepEqual(actor.position.toArray(), [2, 0, 4])
  assert.ok(Math.abs(actor.rotation.y - Math.PI / 2) < 1e-9)
  poses.capture(scene); actor.position.x = 100
  poses.apply(0.1); assert.equal(actor.position.x, 100); poses.restore()
})
