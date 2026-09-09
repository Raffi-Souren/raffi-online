import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as THREE from 'three'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }
const { makeVehicle, animateVehicle, paintVehicle } = await import('../gen/vehicles.js')
const { createActorBatcher } = await import('../engine/actor-batching.js')
const data = JSON.parse(fs.readFileSync(new URL('../data/vehicles.json', import.meta.url)))
const traffic = JSON.parse(fs.readFileSync(new URL('../data/traffic.json', import.meta.url)))
const tiles = new Set()
const atlas = { uv: name => { tiles.add(name); return { u0: 0, v0: 0, u1: 1, v1: 1 } }, uvAt: (_, u, v) => [u, v] }
const material = new THREE.MeshStandardMaterial({ vertexColors: true })
const normalTypes = Object.entries(data.archetypes).filter(([, arch]) => arch.weight > 0).map(([id]) => id)

test('all spawned traffic and parked archetypes have clean shaped geometry and a cheaper distance variant', () => {
  for (const id of new Set([...normalTypes, ...traffic.archetypes])) {
    const car = makeVehicle(data, id, 'fleet-audit', material, atlas, {})
    const [near, far] = car.userData.vehicleLods
    assert.equal(near.wheels.length, 4)
    assert.equal(far.wheels.length, 4)
    assert.ok(near.geometry.index.count / 3 < 4500)
    assert.ok(far.geometry.index.count / 3 < 1300)
    assert.ok(far.geometry.index.count < near.geometry.index.count * .35)
    for (const { geometry: g } of [near, far]) {
      const p = g.attributes.position, n = g.attributes.normal, indices = g.index.array
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3(), normal = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)))
        assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5, `${id} unit normal`)
        assert.ok(p.getY(i) >= -1e-5, `${id} tire contact does not bury the model`)
      }
      for (let i = 0; i < indices.length; i += 3) {
        a.fromBufferAttribute(p, indices[i]); b.fromBufferAttribute(p, indices[i + 1]); c.fromBufferAttribute(p, indices[i + 2])
        cross.crossVectors(b.sub(a), c.sub(a))
        assert.ok(cross.lengthSq() > 1e-20, `${id} no degenerate triangles`)
        normal.fromBufferAttribute(n, indices[i])
        assert.ok(cross.dot(normal) > -1e-8, `${id} smooth normals face outward`)
      }
    }
    const copy = makeVehicle(data, id, 'different-paint', material, atlas, {})
    assert.deepEqual(near.basePositions, copy.userData.basePositions, `${id} shares topology across paint variants`)
    assert.equal(car.userData.length, copy.userData.length, 'collision dimensions remain independent of paint')
  }
  assert.ok(tiles.has('car-glass') && tiles.has('car-rubber') && tiles.has('car-chrome'))
  assert.ok(!tiles.has('blob'), 'body has no detached translucent shadow quad')
})

test('distance handoff preserves one traffic instance, collision handle, paint and wheel rig', () => {
  const scene = new THREE.Scene(), car = makeVehicle(data, 'compact', 17, material, atlas, {})
  scene.add(car); car.position.z = -20
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 200), batcher = createActorBatcher(scene)
  assert.equal(batcher.update(camera).nearVehicles, 1)
  paintVehicle(car, '#e85024', '#1e252e'); animateVehicle(car, .25, 7, .3, true)
  car.position.z = -60
  const farStats = batcher.update(camera)
  assert.equal(farStats.visible, 1); assert.equal(farStats.farVehicles, 1)
  const far = scene.children.find(mesh => mesh.isInstancedMesh && mesh.visible)
  assert.equal(far.geometry.index.count, car.userData.vehicleLods[1].geometry.index.count)
  assert.ok(Array.from(far.geometry.attributes.actorRig.array).some((value, i) => i % 4 === 3 && value === 11), 'front wheels retain their steering pivots')
  assert.ok(Array.from(far.geometry.attributes.actorRegion.array).some((value, i) => i % 2 === 0 && value === 0), 'disjoint painted panels retain their semantic palette region')
  assert.equal(car.visible, true, 'source remains present for gameplay/collision')
  car.position.z = -34
  assert.equal(batcher.update(camera).farVehicles, 1, 'hysteresis prevents repeated handoff around the threshold')
  car.position.z = -28
  assert.equal(batcher.update(camera).nearVehicles, 1)
  assert.equal(batcher.stats.visible, 1, 'handoff never duplicates a traffic actor')
  batcher.dispose()
  assert.equal(car.layers.mask, 1)
})

test('fleet handling and motor voices distinguish sports, service and heavy rides in the actual simulation', async () => {
  const { CollisionWorld, stepVehicle } = await import('../engine/physics.js')
  const { vehicleMotorSignature } = await import('../engine/audio-core.js')
  const result = {}
  for (const id of ['coupe-sport', 'yellow-cab', 'rideshare-sedan', 'delivery-truck']) {
    const arch = data.archetypes[id], world = new CollisionWorld()
    const car = { x:0,z:0,yaw:0,speed:0,lateral:0,angularVel:0,slip:0 }
    for(let i=0;i<240;i++)stepVehicle(car,arch.handling,{throttle:1,brake:0,steer:0},1/60,world)
    const accelerated=car.speed
    car.speed=15;car.x=car.z=0
    let brakeDistance=0
    while(car.speed>.2 && brakeDistance<100){const prev=car.z;stepVehicle(car,arch.handling,{throttle:0,brake:1,steer:0},1/60,world);brakeDistance+=Math.abs(car.z-prev)}
    const turn={x:0,z:0,yaw:0,speed:9,lateral:0,angularVel:0,slip:0}
    for(let i=0;i<60;i++)stepVehicle(turn,arch.handling,{throttle:0,brake:0,steer:.5},1/60,world)
    result[id]={accelerated,brakeDistance,yaw:turn.yaw,motor:vehicleMotorSignature(arch.sound,15,.6)}
  }
  assert.ok(result['coupe-sport'].accelerated>result['yellow-cab'].accelerated+5)
  assert.ok(result['yellow-cab'].accelerated>result['delivery-truck'].accelerated+5)
  assert.ok(result['coupe-sport'].brakeDistance<result['delivery-truck'].brakeDistance)
  assert.ok(result['yellow-cab'].yaw>result['delivery-truck'].yaw)
  assert.ok(result['coupe-sport'].motor.hz>result['delivery-truck'].motor.hz*2)
  assert.ok(result['rideshare-sedan'].motor.gain<result['yellow-cab'].motor.gain)
  assert.ok(data.parked.curated.yards.includes('track-coupe'))
  assert.equal(Object.values(data.parked.curated).filter(list=>list.includes('track-coupe')).length,1)
  for(const id of ['yellow-cab','rideshare-sedan','rideshare-suv','coupe-sport','delivery-truck','pickup'])assert.ok(traffic.archetypes.includes(id),`${id} ordinary traffic`)
})
