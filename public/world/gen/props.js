/**
 * RAFFI WORLD — prop recipe interpreter and street furniture placement.
 *
 * This module contains no knowledge of what a hydrant looks like. It reads the
 * `parts` recipe out of props.json and emits primitives, which means a new prop
 * is a data edit, never a code edit.
 */

import { makeRng } from '../engine/state.js'
import { isOnRoad } from './roads.js'
import { makeBuilderSet, meshesFrom } from './builder.js'

/** Rotate a local offset into world space around Y. */
function rot(px, pz, ry) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return { x: px * c - pz * s, z: px * s + pz * c }
}

/**
 * Emits one prop at a world position.
 * @returns collider descriptor or null
 */
export function emitProp(set, atlas, propsData, name, x, y, z, ry = 0, rng = null, tint = null) {
  const def = propsData.props[name]
  if (!def) return null
  const r = rng || makeRng('prop:' + name + ':' + Math.round(x) + ':' + Math.round(z))
  const white = atlas.uv('white')

  // Resolve any palette roles once so every part of one instance agrees.
  const roleColors = {}
  if (def.palette) {
    for (const [role, list] of Object.entries(def.palette)) roleColors[role] = r.pick(list)
  }

  for (const part of def.parts) {
    const off = rot(part.x || 0, part.z || 0, ry)
    const px = x + off.x
    const pz = z + off.z
    const py = y + (part.y || 0)
    const pry = ry + (part.ry || 0)
    const emissive = (part.emissive || 0) > 0
    const alpha = part.alpha !== undefined && part.alpha < 1
    const target = emissive ? set.emissive : alpha ? set.alpha : set.opaque
    const color = tint || (part.paletteRole ? roleColors[part.paletteRole] : null) || part.color || '#ffffff'
    const rect = part.tile ? atlas.uv(part.tile) : white
    const seg = part.seg || propsData.defaults.seg || 6

    switch (part.shape) {
      case 'box':
        target.box({
          x: px, y: py, z: pz, w: part.w, h: part.h, d: part.d, ry: pry,
          color, rect, emissive,
        })
        break
      case 'cyl':
        target.cylinder({
          x: px, y: py, z: pz, r: part.r, rTop: part.rTop ?? null, h: part.h,
          seg, ry: pry, color, rect, emissive,
        })
        break
      case 'cone':
        target.cone({ x: px, y: py, z: pz, r: part.r, h: part.h, seg, ry: pry, color, rect, emissive, flipY: !!part.flipY })
        break
      case 'sphere':
        target.sphere({ x: px, y: py, z: pz, r: part.r, seg, color, rect, emissive })
        break
      case 'plane':
        target.plane({ x: px, y: py, z: pz, w: part.w, d: part.d, ry: pry, color, rect, emissive })
        break
      case 'ramp':
        target.wedge({ x: px, y: py, z: pz, w: part.w, h: part.h, d: part.d, ry: pry, color, rect })
        break
      default:
        break
    }
  }

  // Blob shadow — the only shadow in the build.
  if (def.castsBlob) {
    const size = def.collide?.r ? def.collide.r * 3.2 : 2.2
    set.alpha.plane({ x, y: y + 0.04, z, w: size, d: size, color: '#000000', rect: atlas.uv('blob') })
  }

  if (!def.collide) return null
  if (def.collide.type === 'circle') return { type: 'circle', x, z, r: def.collide.r, tag: name }
  if (def.collide.type === 'box') {
    const rotated = Math.abs(Math.sin(ry)) > 0.7
    return {
      type: 'box',
      x, z,
      hx: (rotated ? def.collide.d : def.collide.w) / 2,
      hz: (rotated ? def.collide.w : def.collide.d) / 2,
      tag: name,
    }
  }
  if (def.collide.type === 'ramp') {
    return { type: 'ramp', x, z, w: def.collide.w, d: def.collide.d, h: def.collide.h, ry, tag: name }
  }
  return null
}

/** Adds a blob shadow on its own (characters and vehicles use this at runtime). */
export function blobShadow(set, atlas, x, y, z, size, opacity = 1) {
  set.alpha.plane({ x, y, z, w: size, d: size, color: opacity >= 1 ? '#000000' : '#000000', rect: atlas.uv('blob') })
}

/** Builds one movable prop object while preserving the shared material set. */
export function makePropObject(atlas, propsData, name, materials, lighting) {
  if (!propsData.props[name]) return null
  const set = makeBuilderSet(lighting, atlas)
  emitProp(set, atlas, propsData, name, 0, 0, 0, 0, makeRng('runtime-prop:' + name))
  const group = meshesFrom(set, materials, 'runtime-prop:' + name)
  group.userData.prop = name
  return group
}

/**
 * Places repeating street furniture along the road network for one district:
 * lights, trees, hydrants, bins, signals. Everything here respects the
 * district's `propWeights` and `streetTrees` block in blocks.json.
 */
export function placeStreetFurniture(set, atlas, propsData, district, graph, cfg, world) {
  const dcfg = cfg.districts[district.id]
  if (!dcfg) return []
  const rng = makeRng('street:' + district.id + ':' + world.seed)
  const colliders = []
  const b = district.bounds
  const inBounds = (x, z) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ

  const sw = world.roadGraph.sidewalkWidth
  const trees = dcfg.streetTrees || { spacing: 20, chance: 0.3, types: [] }

  // The light archetype this district uses, picked once from propWeights.
  const lightName =
    Object.keys(dcfg.propWeights).find((k) => k.startsWith('streetlight')) || 'streetlight-modern'
  const lightSpacing = district.id === 'yards' ? 46 : 30

  for (const seg of graph.segments) {
    const midX = (seg.ax + seg.bx) / 2
    const midZ = (seg.az + seg.bz) / 2
    if (!inBounds(midX, midZ)) continue

    const steps = Math.max(1, Math.floor(seg.length / lightSpacing))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = seg.ax + (seg.bx - seg.ax) * t
      const z = seg.az + (seg.bz - seg.az) * t
      if (!inBounds(x, z)) continue

      for (const side of [-1, 1]) {
        const ox = seg.horizontal ? 0 : side * (seg.halfWidth + sw * 0.55)
        const oz = seg.horizontal ? side * (seg.halfWidth + sw * 0.55) : 0
        const px = x + ox
        const pz = z + oz
        if (!inBounds(px, pz)) continue

        if (rng.chance(0.72)) {
          // Lamp head points at the road.
          const ry = seg.horizontal ? (side < 0 ? 0 : Math.PI) : side < 0 ? Math.PI / 2 : -Math.PI / 2
          const c = emitProp(set, atlas, propsData, lightName, px, 0, pz, ry, rng)
          if (c) colliders.push(c)
        }

        // Trees between the lights.
        if (trees.types.length && rng.chance(trees.chance * 0.5)) {
          const toff = seg.horizontal ? lightSpacing * 0.4 : 0
          const toff2 = seg.horizontal ? 0 : lightSpacing * 0.4
          const tx = px + toff
          const tz = pz + toff2
          if (inBounds(tx, tz) && !isOnRoad(graph, tx, tz, 1)) {
            const c = emitProp(set, atlas, propsData, rng.pick(trees.types), tx, 0, tz, rng.range(0, 6.28), rng)
            if (c) colliders.push(c)
          }
        }

        // Small furniture, weighted per district.
        if (rng.chance(0.3)) {
          const name = rng.weighted(dcfg.propWeights)
          if (propsData.props[name] && !name.startsWith('streetlight') && !name.startsWith('parking-stripe')) {
            const jx = px + rng.range(-2, 2)
            const jz = pz + rng.range(-2, 2)
            if (inBounds(jx, jz) && !isOnRoad(graph, jx, jz, 0.5)) {
              const c = emitProp(set, atlas, propsData, name, jx, 0, jz, rng.range(0, 6.28), rng)
              if (c) colliders.push(c)
            }
          }
        }
      }
    }
  }

  // Traffic signals + crosswalk signals at intersections inside this district.
  for (const node of graph.nodes.values()) {
    if (!inBounds(node.x, node.z)) continue
    if (node.edges.length < 3) continue
    let maxHw = 0
    for (const e of node.edges) maxHw = Math.max(maxHw, graph.halfWidthAt(e.lanes))
    const off = maxHw + sw * 0.5
    for (const [sx, sz, ry] of [
      [-1, -1, 0], [1, 1, Math.PI],
    ]) {
      const c = emitProp(set, atlas, propsData, 'traffic-light', node.x + sx * off, 0, node.z + sz * off, ry, rng)
      if (c) colliders.push(c)
    }
    for (const [sx, sz] of [[1, -1], [-1, 1]]) {
      const c = emitProp(set, atlas, propsData, 'crosswalk-signal', node.x + sx * off, 0, node.z + sz * off, Math.atan2(-sz, -sx), rng)
      if (c) colliders.push(c)
    }
  }

  return colliders
}

/** Roof props queued by the building generator. */
export function placeRoofProps(set, atlas, propsData, roofProps) {
  const rng = makeRng('roofprops')
  for (const p of roofProps) {
    emitProp(set, atlas, propsData, p.type, p.x, p.y, p.z, p.ry, rng)
  }
}
