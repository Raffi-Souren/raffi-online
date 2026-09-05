/**
 * RAFFI WORLD — generated interior scenes.
 *
 * Three small rooms swapped in at door triggers. Geometry is built from the
 * same atlas / vertex-lighting path as the city; no downloaded assets.
 */

import { makeBuilderSet, meshesFrom } from './builder.js'
import { emitProp } from './props.js'
import { makeRng } from '../engine/state.js'
import { CollisionWorld } from '../engine/physics.js'

function wallBox(set, atlas, x, y, z, w, h, d, color) {
  set.opaque.box({
    x, y, z, w, h, d, color, rect: atlas.uv('white'),
    faces: ['east', 'west', 'south', 'north', 'up'],
  })
  return { type: 'box', x, z, hx: w / 2, hz: d / 2, tag: 'interior-wall' }
}

function buildClub(spec, atlas, materials, props, lighting) {
  const set = makeBuilderSet(lighting, atlas)
  const white = atlas.uv('white')
  const b = spec.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const colliders = []
  const rng = makeRng('interior:club-floor')

  set.opaque.plane({ x: 0, y: 0.02, z: 0, w, d, color: '#1a1220', rect: atlas.uv('road') })
  set.emissive.plane({ x: 0, y: 0.03, z: 0, w: 18, d: 18, color: '#3a1840', rect: white, emissive: true })

  const wallH = 8
  colliders.push(wallBox(set, atlas, 0, wallH / 2, b.minZ + 0.4, w, wallH, 0.8, '#241828'))
  colliders.push(wallBox(set, atlas, 0, wallH / 2, b.maxZ - 0.4, w, wallH, 0.8, '#241828'))
  colliders.push(wallBox(set, atlas, b.minX + 0.4, wallH / 2, 0, 0.8, wallH, d, '#1c1422'))
  colliders.push(wallBox(set, atlas, b.maxX - 0.4, wallH / 2, 0, 0.8, wallH, d, '#1c1422'))

  // DJ booth at the south end — the player stands here for SET TIME.
  colliders.push(wallBox(set, atlas, 0, 0.6, -22, 8, 1.2, 2.4, '#2a2030'))
  set.emissive.box({
    x: 0, y: 1.5, z: -22, w: 6.4, h: 0.18, d: 1.6,
    color: '#39E6FF', rect: white, emissive: true, faces: ['up', 'south', 'east', 'west'],
  })
  for (const x of [-10, 10]) {
    set.emissive.box({
      x, y: 5.4, z: 0, w: 0.3, h: 3.2, d: 16,
      color: '#FF3D8A', rect: white, emissive: true, faces: ['east', 'west', 'south', 'north'],
    })
  }
  emitProp(set, atlas, props, 'blade-sign', -16, 0, 8, 1.57, rng)
  emitProp(set, atlas, props, 'blade-sign', 16, 0, -6, -1.57, rng)

  const group = meshesFrom(set, materials, 'interior:club-floor')
  return { group, colliders, triangles: set.triangleCount }
}

function buildMainframe(spec, atlas, materials, props, lighting) {
  const set = makeBuilderSet(lighting, atlas)
  const white = atlas.uv('white')
  const b = spec.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const colliders = []
  const rng = makeRng('interior:mainframe')

  set.opaque.plane({ x: 0, y: 0.02, z: 30, w, d, color: '#0c1824', rect: atlas.uv('dirt') })

  const wallH = 7
  colliders.push(wallBox(set, atlas, 0, wallH / 2, b.minZ + 0.5, w, wallH, 1, '#163044'))
  colliders.push(wallBox(set, atlas, 0, wallH / 2, b.maxZ - 0.5, w, wallH, 1, '#163044'))
  colliders.push(wallBox(set, atlas, b.minX + 0.5, wallH / 2, 30, 1, wallH, d, '#122838'))
  colliders.push(wallBox(set, atlas, b.maxX - 0.5, wallH / 2, 30, 1, wallH, d, '#122838'))

  // Server cabinets along the long walls.
  for (let i = 0; i < 8; i++) {
    const z = 90 - i * 16
    for (const x of [-28, 28]) {
      set.opaque.box({
        x, y: 1.8, z, w: 4.2, h: 3.6, d: 2.2,
        color: '#2a3a48', rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
      })
      set.emissive.box({
        x: x + (x > 0 ? -2.05 : 2.05), y: 1.8, z, w: 0.08, h: 2.4, d: 1.6,
        color: i % 2 ? '#39E6FF' : '#3DFF9E', rect: white, emissive: true,
        faces: ['east', 'west', 'south', 'north'],
      })
      colliders.push({ type: 'box', x, z, hx: 2.2, hz: 1.2, tag: 'cabinet' })
    }
  }

  // Terminal at the authored goto.
  set.opaque.box({
    x: 0, y: 1.1, z: -48, w: 3.4, h: 2.2, d: 1.6,
    color: '#1a2834', rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
  })
  set.emissive.box({
    x: 0, y: 1.6, z: -47.1, w: 2.4, h: 1.3, d: 0.08,
    color: '#7ecbff', rect: white, emissive: true, faces: ['south', 'east', 'west'],
  })
  colliders.push({ type: 'box', x: 0, z: -48, hx: 1.8, hz: 0.9, tag: 'terminal' })
  emitProp(set, atlas, props, 'beacon', 0, 0, 100, 0, rng)

  const group = meshesFrom(set, materials, 'interior:mainframe')
  return { group, colliders, triangles: set.triangleCount }
}

function buildPitch(spec, atlas, materials, _props, lighting) {
  const set = makeBuilderSet(lighting, atlas)
  const white = atlas.uv('white')
  const b = spec.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const colliders = []

  set.opaque.plane({ x: 0, y: 0.02, z: 0, w, d, color: '#2f6b38', rect: atlas.uv('grass') })
  set.opaque.plane({ x: 0, y: 0.04, z: 0, w: 0.2, d, color: '#f4f0e0', rect: white })
  set.opaque.plane({ x: 0, y: 0.04, z: 0, w, d: 0.2, color: '#f4f0e0', rect: white })

  const wallH = 4.2
  colliders.push(wallBox(set, atlas, 0, wallH / 2, b.minZ + 0.4, w, wallH, 0.8, '#6e6a62'))
  colliders.push(wallBox(set, atlas, 0, wallH / 2, b.maxZ - 0.4, w, wallH, 0.8, '#6e6a62'))
  colliders.push(wallBox(set, atlas, b.minX + 0.4, wallH / 2, 0, 0.8, wallH, d, '#5c584e'))
  colliders.push(wallBox(set, atlas, b.maxX - 0.4, wallH / 2, 0, 0.8, wallH, d, '#5c584e'))

  // North goal.
  for (const x of [-4.2, 4.2]) {
    set.opaque.box({
      x, y: 1.6, z: -30, w: 0.28, h: 3.2, d: 0.28,
      color: '#f2f2f0', rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
    })
    colliders.push({ type: 'box', x, z: -30, hx: 0.14, hz: 0.14, tag: 'goal-post' })
  }
  set.opaque.box({
    x: 0, y: 3.2, z: -30, w: 8.8, h: 0.24, d: 0.24,
    color: '#f2f2f0', rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
  })
  set.emissive.plane({ x: 0, y: 0.05, z: 18, w: 2.4, d: 2.4, color: '#FFE347', rect: white, emissive: true })

  const group = meshesFrom(set, materials, 'interior:pitch')
  return { group, colliders, triangles: set.triangleCount }
}

const BUILDERS = {
  'club-floor': buildClub,
  mainframe: buildMainframe,
  pitch: buildPitch,
}

export function buildInterior(spec, atlas, materials, props, lighting) {
  const builder = BUILDERS[spec.id]
  if (!builder) return null
  const built = builder(spec, atlas, materials, props, lighting)
  const collision = new CollisionWorld()
  collision.addAll(built.colliders)
  built.group.visible = false
  built.group.name = 'interior:' + spec.id
  return {
    spec,
    group: built.group,
    collision,
    colliders: built.colliders,
    triangles: built.triangles,
  }
}

export function buildAllInteriors(worldData, atlas, materials, props, lighting) {
  const rooms = new Map()
  for (const spec of worldData.interiors || []) {
    const built = buildInterior(spec, atlas, materials, props, lighting)
    if (built) rooms.set(spec.id, built)
  }
  return rooms
}
