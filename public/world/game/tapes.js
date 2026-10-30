/**
 * RAFFI WORLD — fourteen BADCOMPANY tapes hidden around the city.
 *
 * Two instanced meshes draw every tape (shell and label), so the whole set
 * costs two draw calls. Walking or riding within reach picks one up: a pop,
 * the pickup sound, a count, and the Lab's Tape Shelf marks it found. The
 * first find unlocks BADCO FM; after that the rest show on the minimap.
 */

import * as THREE from 'three'
import { state, data, bus } from '../engine/state.js'
import { cam } from '../engine/camera.js'
import { toast } from './hud.js'
import { TAPES_KEY, collectTape, readFound, tapeInReach, writeFound } from './tapes-core.js'

const HOVER = 0.95
const POP_SECONDS = 0.28
let group = null, shells = null, labels = null
let found = new Set()
const popping = new Map()
const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const rotation = new THREE.Quaternion()
const scale = new THREE.Vector3()
const euler = new THREE.Euler()

const tapes = () => data.tapes?.tapes || []
const ids = () => tapes().map((tape) => tape.id)
const storage = () => { try { return globalThis.localStorage } catch { return null } }

export function initTapes(scene) {
  found = readFound(storage(), ids())
  const count = tapes().length
  group = new THREE.Group()
  group.name = 'tape-collectibles'
  shells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.07, 0.29), new THREE.MeshBasicMaterial({ color: 0x23282f, fog: true }), count)
  labels = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.074, 0.16), new THREE.MeshBasicMaterial({ color: 0xf0e2bd, fog: true }), count)
  // Each label takes its mix's stripe colour, like the cassettes on the Tape Shelf.
  const stripes = [0xe8692f, 0x1646aa, 0xe5b947, 0xd94b32, 0x30bd75]
  for (let index = 0; index < count; index++) labels.setColorAt(index, new THREE.Color(stripes[index % stripes.length]).lerp(new THREE.Color(0xf0e2bd), 0.35))
  for (const mesh of [shells, labels]) { mesh.frustumCulled = false; mesh.name = 'tape-collectible'; group.add(mesh) }
  scene.add(group)
  applyTapeUnlocks()
  place(0)
  publishMarkers()
}

/** BADCO FM opens with the first tape; saves loaded later keep it open. */
export function applyTapeUnlocks() {
  if (!found.size) return
  for (const station of data.radio?.stations || []) if (station.hostMixes) station.unlocked = true
}

function publishMarkers() {
  // Remaining tapes appear on the maps only once you know there are tapes to find.
  state.tapeMarkers = found.size ? tapes().filter((tape) => !found.has(tape.id)).map((tape) => tape.at) : []
}

function place(time) {
  const still = cam.reducedMotion
  tapes().forEach((tape, index) => {
    const pop = popping.get(tape.id)
    let size = found.has(tape.id) && !pop ? 0 : 1
    if (pop) {
      const t = Math.min(1, (state.time - pop) / POP_SECONDS)
      size = t < 0.4 ? 1 + t / 0.4 * 0.3 : 1.3 * (1 - (t - 0.4) / 0.6)
      if (t >= 1) { popping.delete(tape.id); size = 0 }
    }
    const spin = still ? 0.6 : time * 1.6 + index
    const bob = still ? 0 : Math.sin(time * 2.2 + index) * 0.08
    position.set(tape.at.x, HOVER + bob, tape.at.z)
    rotation.setFromEuler(euler.set(0.35, spin, 0))
    scale.setScalar(Math.max(0, size))
    matrix.compose(position, rotation, scale)
    shells.setMatrixAt(index, matrix)
    position.y += 0.004
    matrix.compose(position, rotation, scale)
    labels.setMatrixAt(index, matrix)
  })
  shells.instanceMatrix.needsUpdate = true
  labels.instanceMatrix.needsUpdate = true
}

/** One fixed step: animate, and pick up a tape in reach. */
export function updateTapes() {
  if (!group) return
  group.visible = !state.interior
  if (!state.interior) {
    const p = state.player
    const reach = (data.tapes?.pickupRadius || 1.4) + (state.mode === 'vehicle' ? 0.9 : 0)
    const tape = tapeInReach(tapes(), found, p.x, p.z, reach)
    if (tape) pickUp(tape)
  }
  place(state.time)
}

function pickUp(tape) {
  const result = collectTape(found, tape.id, ids())
  if (!result.added) return
  writeFound(storage(), found)
  if (!cam.reducedMotion) popping.set(tape.id, state.time)
  bus.emit('sfx', 'pickup')
  const total = tapes().length
  const first = result.count === 1
  applyTapeUnlocks()
  publishMarkers()
  toast(first
    ? `TAPE FOUND · ${tape.title} · 1/${total} · BADCO FM is on the radio now`
    : `TAPE ${result.count}/${total} · ${tape.title}${result.count === total ? ' · the whole shelf' : ''}`, 4)
}

/** Read-only, for smokes and the phone. */
export function tapesSnapshot() {
  return { key: TAPES_KEY, total: tapes().length, found: [...found], markers: (state.tapeMarkers || []).length }
}
