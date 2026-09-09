import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as THREE from 'three'

globalThis.location = { search: '' }
globalThis.matchMedia = () => ({ matches: false })
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }

const { createActorBatcher } = await import('../engine/actor-batching.js')
const { makePed, animatePed } = await import('../gen/peds.js')
const { makeVehicle, animateVehicle, paintVehicle } = await import('../gen/vehicles.js')
const { hexToRgb } = await import('../engine/state.js')
const { actorCollisionBodies } = await import('../engine/actor-collisions.js')
const load = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
const npcs = load('npcs'), vehicles = load('vehicles')
const atlas = { uv: () => ({ u0: 0, v0: 0, u1: 1, v1: 1 }), uvAt: (_, u, v) => [u, v] }
const material = new THREE.MeshStandardMaterial({ vertexColors: true })
const makePerson = (seed, colors) => makePed(npcs, 'commuter', seed, material, atlas, {}, { colors, includeShadow: false })
const batchMeshes = scene => scene.children.filter(object => object.isInstancedMesh)

test('skinned foreground replacement suppresses only the proxy draw, preserving collision and restoration', () => {
  const scene=new THREE.Scene(),person=makePerson('near-proxy')
  scene.add(person)
  person.userData.presentationOriginalLayers=person.layers.mask
  person.userData.presentationReplaced=true
  person.layers.set(31)
  const batcher=createActorBatcher(scene)
  assert.equal(batcher.update().visible,0)
  assert.equal(person.visible,true)
  assert.equal(actorCollisionBodies(scene.children,0,0).length,1)
  delete person.userData.presentationReplaced
  assert.equal(batcher.update().visible,1)
  batcher.dispose()
  assert.equal(person.layers.mask,1)
})

test('pooled pedestrians use instancing with independent transforms, palette and animation', () => {
  const scene = new THREE.Scene()
  // Bag variations are valid separate topologies; find two matching ones.
  const people = Array.from({ length: 4 }, (_, i) => makePerson('batch-' + i, { shirt: i % 2 ? '#306fc1' : '#bc342b' }))
  people.forEach((person, i) => { person.position.set(i * 2, 0, -i); scene.add(person) })
  const batcher = createActorBatcher(scene)
  const stats = batcher.update()
  assert.equal(stats.sources, 4)
  assert.equal(stats.visible, 4)
  assert.ok(stats.batches <= 2)
  assert.equal(batchMeshes(scene).reduce((sum, mesh) => sum + mesh.count, 0), 4)
  for (const person of people) assert.equal(person.layers.mask, (1 << 31) >>> 0)
  const first = people[0]
  const before = new Float32Array(first.geometry.attributes.position.array)
  animatePed(first, npcs, 'run', 0.1, 3)
  assert.deepEqual(first.geometry.attributes.position.array, before, 'pooled pose must not rewrite CPU vertex buffers')
  assert.ok(first.userData.instancePose.some(value => Math.abs(value) > 0.1))
  batcher.update()
  const instance = batchMeshes(scene).find(mesh => mesh.geometry.attributes.position.count === first.geometry.attributes.position.count)
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <color_vertex>' }
  instance.material.onBeforeCompile(shader, {})
  const data = shader.uniforms.actorData.value.image.data
  assert.ok(data.some((value, i) => i % 32 >= 24 && i % 32 < 28 && Math.abs(value) > 0.1), 'pose uploaded per instance')
  assert.match(shader.vertexShader, /poseActor\(objectNormal, true\)/)
  assert.match(shader.vertexShader, /readActor\(actorRegion.x\)/)
  assert.equal(instance.geometry.attributes.actorDataRow.isInstancedBufferAttribute, true)
  const shadowShader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>' }
  instance.customDepthMaterial.onBeforeCompile(shadowShader, {})
  assert.match(shadowShader.vertexShader, /transformed = poseActor/)
  batcher.dispose()
  people.forEach(person => { assert.equal(person.layers.mask, 1); assert.equal(person.userData.actorBatched, undefined) })
  assert.equal(batchMeshes(scene).length, 0)
})

test('car variants share body geometry while preserving individual paints and wheel poses', () => {
  const scene = new THREE.Scene()
  const archetype = 'grand-tourer'
  const a = makeVehicle(vehicles, archetype, 1, material, atlas, {})
  const b = makeVehicle(vehicles, archetype, 2, material, atlas, {})
  assert.deepEqual(a.userData.basePositions, b.userData.basePositions)
  scene.add(a, b)
  b.position.x = 8
  const batcher = createActorBatcher(scene)
  assert.equal(batcher.update().batches, 1)
  paintVehicle(a, '#ff2200', '#24242b')
  paintVehicle(b, '#0088ff', '#ddeeff')
  animateVehicle(a, 0.5, 12, 0.4, true)
  animateVehicle(b, 0.5, 3, -0.3, false)
  batcher.update()
  const instance = batchMeshes(scene)[0]
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <color_vertex>' }
  instance.material.onBeforeCompile(shader, {})
  const values = shader.uniforms.actorData.value.image.data
  const red = hexToRgb('#ff2200'), blue = hexToRgb('#0088ff')
  assert.ok(Math.abs(values[0] - red.r) < 1e-6)
  assert.ok(Math.abs(values[32 + 2] - blue.b) < 1e-6)
  assert.notEqual(values[24], values[32 + 24], 'wheel spin is independent')
  assert.notEqual(values[25], values[32 + 25], 'front wheel steering is independent')
  assert.ok(values[8] > values[32 + 8], 'braking changes only its own tail lamps')
  const transform = new THREE.Matrix4()
  instance.getMatrixAt(1, transform)
  assert.equal(transform.elements[12], 8)
  batcher.dispose()
})

test('visibility, camera culling, late spawns and capacity preserve the actor pool', () => {
  const scene = new THREE.Scene()
  const cars = Array.from({ length: 5 }, (_, i) => makeVehicle(vehicles, 'grand-tourer', i, material, atlas, {}))
  cars.forEach((car, i) => { car.position.set(i * 3, 0, -20); scene.add(car) })
  const batcher = createActorBatcher(scene, { capacity: 2 })
  assert.equal(batcher.update().batches, 3)
  cars[0].visible = false
  scene.remove(cars[1])
  assert.equal(batcher.update().visible, 3)
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
  camera.lookAt(0, 0, -20)
  cars[4].position.x = 1000
  assert.equal(batcher.update(camera).visible, 2)
  const late = makeVehicle(vehicles, 'grand-tourer', 'late', material, atlas, {})
  late.position.z = -20
  scene.add(late)
  assert.equal(batcher.update(camera).visible, 3)
  batcher.dispose()
})

test('quality material changes preserve instancing hooks and unique player geometry stays separate', () => {
  const scene = new THREE.Scene()
  const person = makePerson('quality')
  scene.add(person)
  const player = new THREE.Group()
  player.name = 'player'
  player.add(makePerson('player'))
  scene.add(player)
  const batcher = createActorBatcher(scene)
  assert.equal(batcher.update().sources, 1)
  const low = new THREE.MeshBasicMaterial({ vertexColors: true })
  person.material = low
  batcher.update()
  assert.equal(batchMeshes(scene).length, 1)
  assert.equal(batchMeshes(scene)[0].material.isMeshBasicMaterial, true)
  assert.equal(batchMeshes(scene)[0].material.userData.worldRole, null)
  assert.equal(player.children[0].layers.mask, 1)
  batcher.dispose()
  low.dispose()
})

test('retired vehicles release both LOD batches and never consume future pool capacity', () => {
  const scene=new THREE.Scene(), batcher=createActorBatcher(scene,{capacity:2})
  const resident=makeVehicle(vehicles,'compact','resident',material,atlas,{})
  scene.add(resident)
  batcher.update()
  for (let cycle=0;cycle<20;cycle++) {
    const vehicle=makeVehicle(vehicles,'compact',cycle,material,atlas,{})
    let farDisposals=0
    vehicle.userData.vehicleLods[1].geometry.addEventListener('dispose',()=>farDisposals++)
    scene.add(vehicle)
    assert.equal(batcher.update().sources,2)
    assert.equal(batchMeshes(scene).length,2,'one shared near/far pair is enough for both vehicles')
    vehicle.removeFromParent();vehicle.geometry.dispose()
    assert.equal(farDisposals,1)
    assert.equal(batcher.update().sources,1)
    assert.equal(vehicle.userData.actorBatched,undefined)
    assert.equal(vehicle.layers.mask,1)
    assert.equal(batchMeshes(scene).length,2)
  }
  let disposed=0
  for (const mesh of batchMeshes(scene)) for (const resource of [mesh.geometry,mesh.material,mesh.customDepthMaterial]) resource.addEventListener('dispose',()=>disposed++)
  resident.removeFromParent();resident.geometry.dispose()
  assert.equal(batcher.update().sources,0)
  assert.equal(batchMeshes(scene).length,0)
  assert.equal(disposed,6,'retiring the last source disposes the shared GPU resources')
  batcher.dispose()
})

test('removing an actor parent group also unregisters its nested actors', () => {
  const scene=new THREE.Scene(),root=new THREE.Group(),person=makePerson('nested-lifecycle')
  root.add(person);scene.add(root)
  const batcher=createActorBatcher(scene)
  assert.equal(batcher.update().sources,1)
  root.removeFromParent()
  assert.equal(batcher.update().sources,0)
  assert.equal(batchMeshes(scene).length,0)
  batcher.dispose()
})
