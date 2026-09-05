import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as THREE from 'three'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { CollisionWorld, resolveCircle, moveCircle } = await import('../engine/physics.js')
const { actorCollisionBodies } = await import('../engine/actor-collisions.js')
const { emitProp } = await import('../gen/props.js')
const { buildLandmarks } = await import('../gen/world.js')
const { buildInterior } = await import('../gen/interiors.js')
const { hideExteriorEntities } = await import('../game/interiors.js')
const { state, data } = await import('../engine/state.js')
const { cam } = await import('../engine/camera.js')
const { initPlayer, player, updatePlayer, settlePlayerContacts } = await import('../game/player.js')

const readData = (name) =>
  JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
const worldData = readData('world')
const props = readData('props')
const blocks = readData('blocks')
const atlas = { uv: () => [0, 0, 1, 1], uvAt: (_rect, u, v) => [u, v] }
const materials = Object.fromEntries(
  ['opaque', 'emissive', 'alpha', 'actor'].map((key) => [key, new THREE.MeshBasicMaterial()]),
)
const noopBuilder = {
  quad() {},
  box() {},
  plane() {},
  billboard() {},
  cylinder() {},
  cone() {},
  sphere() {},
  wedge() {},
}
const noopSet = { opaque: noopBuilder, emissive: noopBuilder, alpha: noopBuilder }
const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)

function collisionWorld(...colliders) {
  const world = new CollisionWorld()
  world.addAll(colliders)
  return world
}

function pedAt(x, z, visible = true) {
  const mesh = new THREE.Object3D()
  mesh.name = 'ped:commuter'
  mesh.userData.rig = 'biped'
  mesh.position.set(x, 0, z)
  mesh.visible = visible
  return mesh
}

test('an actor exactly centered in a circular prop is separated with finite coordinates', () => {
  const result = resolveCircle(collisionWorld({ type: 'circle', x: 2, z: 3, r: 0.3 }), 2, 3, 0.45)
  assert.equal(result.hit, true)
  close(Math.hypot(result.x - 2, result.z - 3), 0.75)
  assert.ok(Number.isFinite(result.normalX) && Number.isFinite(result.normalZ))
})

test('a whole sprint path cannot tunnel through a thin pole or pedestrian', () => {
  const pole = collisionWorld({ type: 'circle', x: 0, z: 0, r: 0.15 })
  const poleResult = moveCircle(pole, -3, 0, 8, 0, 0.45)
  close(poleResult.x, -0.6)
  const bodies = actorCollisionBodies([pedAt(0, 0)], -3, 0)
  const pedestrianResult = moveCircle(collisionWorld(), -3, 0, 8, 0, 0.45, bodies)
  close(pedestrianResult.x, -0.85)
})

test('diagonal movement slides along a wall and can route around a pedestrian', () => {
  const wall = collisionWorld({ type: 'box', x: 0, z: 0, hx: 0.2, hz: 10 })
  const result = moveCircle(wall, -1, -3, 3, 3, 0.45)
  close(result.x, -0.65)
  close(result.z, 0)
  const bodies = actorCollisionBodies([pedAt(0, 0)], -1, 0)
  const around = moveCircle(collisionWorld(), -1, 0, 4, 2, 0.45, bodies)
  assert.ok(around.x > 2 && around.z > 1, 'contact must not freeze navigation around someone')
})

test('rotated props retain their rendered footprint without filling empty bounding-box corners', () => {
  const propData = { defaults: {}, props: { bench: { parts: [], collide: { type: 'box', w: 6, d: 0.6 } } } }
  const angle = Math.PI / 4
  const prop = emitProp(noopSet, atlas, propData, 'bench', 0, 0, 0, angle)
  const world = collisionWorld(prop)
  const along = 2.7 / Math.sqrt(2)
  assert.equal(resolveCircle(world, along, along, 0.45).hit, true, 'solid diagonal tip')
  assert.equal(resolveCircle(world, 2, -2, 0.45).hit, false, 'empty AABB corner remains open')
  close(prop.ry, angle)
})

test('rotated static footprints are indexed in every spatial cell they occupy', () => {
  const box = { type: 'box', x: 20, z: 0, hx: 0.2, hz: 12, ry: -Math.PI / 2 }
  const world = collisionWorld(box)
  assert.ok(world.query(30, 0, 0.45).includes(box))
  assert.equal(resolveCircle(world, 30, 0, 0.45).hit, true)
})

test('parked vehicle collision follows the actual mesh rotation and body dimensions', () => {
  const car = new THREE.Object3D()
  car.userData = { width: 2, length: 6 }
  car.rotation.y = Math.PI / 4
  const bodies = actorCollisionBodies([car], 0, 0)
  const corner = 2.5 / Math.sqrt(2)
  assert.equal(resolveCircle(collisionWorld(), corner, corner, 0.45, 4, bodies).hit, true)
  assert.equal(resolveCircle(collisionWorld(), corner, -corner, 0.45, 4, bodies).hit, false)
  const result = moveCircle(collisionWorld(), -5, 0, 10, 0, 0.45, bodies)
  assert.ok(result.hit, 'foot movement must register the parked car')
})

test('hidden exterior actors, inactive pools, ghosts and another floor never block interiors', () => {
  const scene = new THREE.Scene()
  const playerRoot = new THREE.Group()
  const ambient = pedAt(0, 0)
  const inactive = pedAt(0, 0, false)
  const overhead = pedAt(0, 0)
  overhead.position.y = 8
  const ghostRoot = new THREE.Group()
  ghostRoot.add(pedAt(0, 0))
  scene.add(playerRoot, ambient, inactive, overhead, ghostRoot)
  assert.equal(actorCollisionBodies(scene.children, 0, 0, playerRoot).length, 1)
  hideExteriorEntities(scene, playerRoot)
  assert.equal(actorCollisionBodies(scene.children, 0, 0, playerRoot).length, 0)
  const keeper = pedAt(1, 0)
  scene.add(keeper)
  assert.equal(actorCollisionBodies(scene.children, 0, 0, playerRoot).length, 1)
})

test('actor contact cannot push a player inside an adjacent solid wall', () => {
  const wall = collisionWorld({ type: 'box', x: 1, z: 0, hx: 0.5, hz: 5 })
  const result = resolveCircle(wall, 0, 0, 0.45, 4, [{ type: 'circle', x: -0.4, z: 0, r: 0.4 }])
  assert.ok(result.x <= 0.05 + 1e-6)
  const staticOnly = resolveCircle(wall, result.x, result.z, 0.45)
  close(staticOnly.x, result.x)
  close(staticOnly.z, result.z)
})

test('sprinting into a pedestrian moving toward the player never swaps their sides', () => {
  let playerX = -3
  let pedestrianX = 0
  for (let frame = 0; frame < 45; frame++) {
    const body = { type: 'circle', x: pedestrianX, z: 0, r: 0.4 }
    const walked = moveCircle(collisionWorld(), playerX, 0, 6.2 * 0.05, 0, 0.45, [body])
    pedestrianX -= 3.2 * 0.05
    body.x = pedestrianX
    const settled = resolveCircle(collisionWorld(), walked.x, 0, 0.45, 4, [body])
    playerX = settled.x
    assert.ok(playerX <= pedestrianX - 0.85 + 1e-6, 'head-on motion must stay on the approach side')
  }
})

test('ramps remain traversable and report raised ground instead of a solid wall', () => {
  const ramp = collisionWorld({ type: 'ramp', x: 0, z: 0, w: 5, d: 8, h: 2, ry: 0 })
  const result = moveCircle(ramp, 0, 5, 0, -5, 0.45)
  assert.equal(result.hit, false)
  close(result.z, 0)
  close(result.y, 1)
})

test('ground landmark furniture registers solids while roof details leave the street clear', () => {
  const all = worldData.districts.flatMap((district) =>
    buildLandmarks(noopSet, atlas, props, worldData, district.id),
  )
  assert.equal(all.filter((item) => item.tag === 'floodlight-pylon').length, 6)
  assert.equal(all.filter((item) => item.tag === 'neon-pole').length, 2)
  const craneCount = worldData.landmarks
    .filter((item) => item.type === 'gantry-cranes')
    .reduce((n, item) => n + (item.count || 3), 0)
  assert.equal(all.filter((item) => item.tag === 'crane-small').length, craneCount)
  assert.ok(all.filter((item) => item.tag === 'stadium').every((item) => Number.isFinite(item.ry)))
  assert.equal(
    all.some((item) => item.tag === 'water-tank'),
    false,
  )
  const lobby = worldData.landmarks.find((item) => item.type === 'lobby')
  const entrance = moveCircle(collisionWorld(...all), lobby.at.x, lobby.at.z + 27, 0, -10, 0.45)
  close(entrance.z, lobby.at.z + 17)
  assert.equal(entrance.hit, false, 'the lobby south entrance remains open')
})

test('new apartment and record-shop planters are solid while the mission approaches remain open', () => {
  const all = worldData.districts.flatMap((district) => buildLandmarks(noopSet, atlas, props, worldData, district.id))
  const solids = collisionWorld(...all)
  for (const [x, z] of [[-466, -160], [-434, -160], [-87, 114], [-33, 114]]) {
    assert.equal(resolveCircle(solids, x, z, 0.45).hit, true, `planter at ${x},${z}`)
  }
  const apartment = moveCircle(solids, -450, -154, 0, -8, 0.45)
  close(apartment.z, -162)
  assert.equal(apartment.hit, false, 'apartment entrance stays accessible')
  const records = moveCircle(solids, -60, 105, 0, 7, 0.45)
  close(records.z, 112)
  assert.equal(records.hit, false, 'Crate Quest discovery point stays accessible')
})

test('interior booth and goal posts are solid, with the goal mouth and spawn routes open', () => {
  for (const spec of worldData.interiors) {
    const room = buildInterior(spec, atlas, materials, props, blocks.vertexLighting)
    assert.equal(
      resolveCircle(room.collision, spec.spawn.x, spec.spawn.z, 0.45).hit,
      false,
      `${spec.id} spawn`,
    )
    if (spec.id === 'club-floor') {
      const booth = moveCircle(room.collision, 0, -18, 0, -8, 0.45)
      close(booth.z, -20.35)
    }
    if (spec.id === 'pitch') {
      assert.equal(resolveCircle(room.collision, 4.2, -30, 0.45).hit, true)
      assert.equal(moveCircle(room.collision, 0, -27, 0, -6, 0.45).hit, false)
    }
    room.group.traverse((object) => object.geometry?.dispose())
  }
})

test('real player movement stops against a scene pedestrian and resolves its later movement', () => {
  Object.assign(data, { world: worldData, blocks, npcs: readData('npcs'), vehicles: readData('vehicles') })
  Object.assign(state.player, { x: 0, z: 0, y: 0, vx: 0, vz: 0, yaw: 0 })
  state.mode = 'foot'
  const scene = new THREE.Scene()
  initPlayer(scene, materials, atlas)
  cam.modeIndex = 0
  cam.currentYaw = -Math.PI
  cam.camera = null
  const pedestrian = pedAt(2, 0)
  scene.add(pedestrian)
  const world = collisionWorld()
  for (let i = 0; i < 90; i++) updatePlayer(1 / 60, { move: { x: 1, y: 0 }, run: true }, world, 0)
  close(state.player.x, 1.15)
  close(player.group.position.x, state.player.x)
  assert.ok(state.player.speed < 0.1, 'a blocked player should stop running in place')
  pedestrian.position.x -= 0.2
  settlePlayerContacts(world)
  assert.ok(Math.hypot(state.player.x - pedestrian.position.x, state.player.z) >= 0.85 - 1e-6)
  close(player.group.position.x, state.player.x)

  // The startup fallback has no camera matrix yet. A zeroed impact velocity
  // must still preserve the heading when held-forward input reaches a body.
  Object.assign(state.player, { x: 0, z: 0, y: 0, vx: 0, vz: 0, yaw: Math.PI / 2 })
  pedestrian.position.x = 2
  cam.modeIndex = 1
  for (let i = 0; i < 90; i++) updatePlayer(1 / 60, { move: { x: 0, y: 1 }, run: true }, world, 0)
  close(state.player.x, 1.15)
  close(state.player.yaw, Math.PI / 2)
  scene.traverse((object) => object.geometry?.dispose())
})
