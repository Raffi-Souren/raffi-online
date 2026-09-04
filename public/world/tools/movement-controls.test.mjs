import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as THREE from 'three'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { state, data } = await import('../engine/state.js')
const { CollisionWorld, stepVehicle } = await import('../engine/physics.js')
const { cam, initCamera, setCameraMode, updateCamera, movementBasis } = await import('../engine/camera.js')
const { initPlayer, player, updatePlayer, spawnVehicle, enterVehicle } = await import('../game/player.js')

for (const name of ['world', 'blocks', 'npcs', 'vehicles']) {
  data[name] = JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
}
const atlas = { uv: () => [0, 0, 1, 1], uvAt: (_rect, u, v) => [u, v] }
const material = new THREE.MeshBasicMaterial()
const materials = { actor: material }
const dt = 1 / 60
const input = (x, y, options = {}) => ({
  move: { x, y },
  throttle: 0,
  brake: 0,
  handbrake: false,
  run: false,
  ...options,
})

function setup(t) {
  state.mode = 'foot'
  Object.assign(state.player, { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, vehicle: null })
  player.vehicle = null
  player.trick = null
  player.steerBias = 0
  const scene = new THREE.Scene()
  initPlayer(scene, materials, atlas)
  initCamera(16 / 9)
  setCameraMode('chase')
  updateCamera(0, state.player, { x: 0, z: 0 }, 16 / 9)
  const world = new CollisionWorld()
  t.after(() => scene.traverse((object) => object.geometry?.dispose()))
  return { scene, world }
}

function frame(world, controls) {
  updatePlayer(dt, controls, world, 0)
  updateCamera(dt, state.player, { x: state.player.vx, z: state.player.vz }, 16 / 9)
}

test('held diagonal walking in chase view travels straight and stops promptly on release', (t) => {
  const { world } = setup(t)
  const basis = movementBasis()
  const dx = (basis.rx + basis.fx) / Math.sqrt(2)
  const dz = (basis.rz + basis.fz) / Math.sqrt(2)
  const yaw = cam.currentYaw
  for (let i = 0; i < 120; i++) frame(world, input(1, 1))
  assert.ok(state.player.x * dx + state.player.z * dz > 6)
  assert.ok(
    Math.abs(state.player.x * dz - state.player.z * dx) < 0.01,
    'body-relative feedback curved the walking path',
  )
  assert.ok(Math.abs(cam.currentYaw - yaw) < 0.01, 'chase camera orbited during walking')
  for (let i = 0; i < 10; i++) frame(world, input(0, 0))
  assert.ok(state.player.speed < 0.1, 'release leaves residual sliding')
})

test('held diagonal chase input cannot cross a wall while the camera recenters at contact', (t) => {
  const { world } = setup(t)
  const normal = { x: -Math.SQRT1_2, z: Math.SQRT1_2 }
  world.add({ type: 'box', x: normal.x * 3, z: normal.z * 3, hx: 30, hz: 0.1, ry: Math.PI / 4 })
  let reachedWall = false
  for (let i = 0; i < 180; i++) {
    frame(world, input(1, 1, { run: true }))
    const distance = state.player.x * normal.x + state.player.z * normal.z
    reachedWall ||= distance > 2.4
    assert.ok(distance <= 2.451, 'camera recenter let the player cross the wall')
  }
  assert.equal(reachedWall, true)
  for (let i = 0; i < 15; i++) frame(world, input(0, 0))
  assert.ok(state.player.speed < 0.1)
})

test('chase D steering turns the car nose toward screen-right', (t) => {
  const { scene, world } = setup(t)
  const vehicle = spawnVehicle(scene, materials, atlas, 'grand-tourer', 0, 0, 0, 'steering-test')
  enterVehicle(vehicle)
  setCameraMode('chase')
  updateCamera(0, state.player, { x: 0, z: 0 }, 16 / 9)
  cam.camera.updateMatrixWorld(true)
  for (let i = 0; i < 30; i++) updatePlayer(dt, input(1, 1, { throttle: 1 }), world, 0)
  const center = new THREE.Vector3(vehicle.x, 1, vehicle.z).project(cam.camera)
  const nose = new THREE.Vector3(
    vehicle.x + Math.sin(vehicle.yaw) * 2,
    1,
    vehicle.z + Math.cos(vehicle.yaw) * 2,
  ).project(cam.camera)
  assert.ok(nose.x > center.x + 0.01, 'D steered left in the chase camera projection')
  assert.ok(vehicle.speed > 1)
})

test('side-only camera-relative input accelerates an aligned car', (t) => {
  const { scene, world } = setup(t)
  setCameraMode('classic')
  updateCamera(0, state.player, { x: 0, z: 0 }, 16 / 9)
  const basis = movementBasis()
  const vehicle = spawnVehicle(
    scene,
    materials,
    atlas,
    'grand-tourer',
    0,
    0,
    Math.atan2(basis.rx, basis.rz),
    'side-test',
  )
  enterVehicle(vehicle)
  for (let i = 0; i < 60; i++) frame(world, input(1, 0))
  assert.ok(vehicle.speed > 4, 'side-only input did not provide throttle')
  assert.ok(Math.hypot(vehicle.x, vehicle.z) > 2)
})

function vehicleState(speed) {
  return { x: 0, z: 0, yaw: 0, speed, lateral: 0, angularVel: 0, slip: 0 }
}

test('reverse steering stays continuous across the old sign-flip threshold', () => {
  const handling = { ...data.vehicles.archetypes['grand-tourer'].handling, coastFriction: 0, drag: 0 }
  const slow = vehicleState(-0.14)
  const fast = vehicleState(-0.16)
  const controls = { throttle: 0, brake: 0, steer: 1, handbrake: false }
  stepVehicle(slow, handling, controls, dt, new CollisionWorld())
  stepVehicle(fast, handling, controls, dt, new CollisionWorld())
  assert.ok(slow.angularVel < 0 && fast.angularVel < 0)
  assert.ok(
    Math.abs(fast.angularVel - slow.angularVel) < 0.1,
    'reverse rotation snapped across the speed threshold',
  )
})

test('backing up and turning creates less lateral slide than the same forward turn', () => {
  const handling = data.vehicles.archetypes['grand-tourer'].handling
  const forward = { ...vehicleState(4), angularVel: 0.4 }
  const reverse = { ...vehicleState(-4), angularVel: 0.4 }
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }
  stepVehicle(forward, handling, controls, dt, new CollisionWorld())
  stepVehicle(reverse, handling, controls, dt, new CollisionWorld())
  assert.ok(Math.abs(reverse.lateral) < Math.abs(forward.lateral) * 0.6)
})
