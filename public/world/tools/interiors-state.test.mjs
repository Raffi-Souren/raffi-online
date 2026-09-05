import assert from 'node:assert/strict'
import test from 'node:test'

import * as THREE from 'three'

// engine/state.js reads the browser shell at module evaluation time.
globalThis.location = { search: '' }
globalThis.window = { devicePixelRatio: 1 }
globalThis.screen = { width: 1280, height: 720 }
globalThis.matchMedia = () => ({ matches: false })

const {
  captureGradeState,
  hideExteriorEntities,
  restoreExteriorEntities,
  restoreGradeState,
} = await import('../game/interiors.js')

test('interior visibility excludes the player and preserves inactive pools', () => {
  const scene = new THREE.Scene()
  const playerRoot = new THREE.Group()
  playerRoot.name = 'player'
  const playerPed = new THREE.Object3D()
  playerPed.name = 'ped:commuter'
  playerRoot.add(playerPed)
  scene.add(playerRoot)

  const ambientPed = new THREE.Object3D()
  ambientPed.name = 'ped:raver'
  const inactivePursuer = new THREE.Object3D()
  inactivePursuer.name = 'ped:suit'
  inactivePursuer.visible = false
  const parkedVehicle = new THREE.Object3D()
  parkedVehicle.name = 'vehicle:compact'
  const pursuitDrone = new THREE.Object3D()
  pursuitDrone.name = 'pursuer-drone'
  const water = new THREE.Object3D()
  water.name = 'water'
  const staticProp = new THREE.Object3D()
  staticProp.name = 'mission-marker'
  scene.add(ambientPed, inactivePursuer, parkedVehicle, pursuitDrone, water, staticProp)

  const hidden = hideExteriorEntities(scene, playerRoot)

  assert.equal(playerPed.visible, true)
  assert.equal(ambientPed.visible, false)
  assert.equal(inactivePursuer.visible, false)
  assert.equal(parkedVehicle.visible, false)
  assert.equal(pursuitDrone.visible, false)
  assert.equal(water.visible, false)
  assert.equal(staticProp.visible, true)

  restoreExteriorEntities(hidden)
  assert.equal(playerPed.visible, true)
  assert.equal(ambientPed.visible, true)
  assert.equal(inactivePursuer.visible, false)
  assert.equal(parkedVehicle.visible, true)
  assert.equal(pursuitDrone.visible, true)
  assert.equal(water.visible, true)
  assert.equal(staticProp.visible, true)
  assert.equal(hidden.size, 0)
})

test('interior grade round-trip preserves an in-flight automatic transition', () => {
  const grade = {
    current: 'haze',
    target: 'night',
    blend: 0.37,
    forced: null,
  }
  const saved = captureGradeState(grade)

  Object.assign(grade, {
    current: 'mainframe',
    target: 'mainframe',
    blend: 1,
    forced: 'night',
  })
  restoreGradeState(grade, saved)

  assert.deepEqual(grade, {
    current: 'haze',
    target: 'night',
    blend: 0.37,
    forced: null,
  })
})
