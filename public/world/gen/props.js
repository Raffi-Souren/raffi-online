/**
 * RAFFI WORLD — prop recipe interpreter and street furniture placement.
 *
 * This module contains no knowledge of what a hydrant looks like. It reads the
 * `parts` recipe out of props.json and emits primitives, which means a new prop
 * is a data edit, never a code edit.
 *
 * PERF: street furniture is thinned (wider light spacing, lower chance rolls).
 * Blobs skip on tiny props. Segment counts live in props.json defaults.
 */

import { makeRng } from '../engine/state.js'
import { isOnRoad } from './roads.js'
import { makeBuilderSet, meshesFrom } from './builder.js'
import { emitBranch, emitLeafCluster } from './foliage.js'

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
    if (part.lightSource && emissive && atlas.lightSources) {
      const type = name.includes('strip') || name.includes('neon') ? 'neon' : 'street'
      atlas.lightSources.push({ x: px, y: py - 0.12, z: pz, color, power: name.includes('floodlight') ? 320 : type === 'neon' ? 85 : 150,
        distance: name.includes('floodlight') ? 42 : type === 'neon' ? 18 : 26, type })
    }
    const seg = Math.max(part.shape === 'cyl' ? 8 : 4, part.seg || propsData.defaults.seg || 6)
    const start = target.vertCount

    // Instanced leaf sprays leave gaps around a visible branching structure.
    // This stream never consumes the street-placement RNG.
    if (part.shape === 'cone' && (name.startsWith('broadleaf') || name === 'planter-tree' || name === 'scrub')) {
      const foliageRng = makeRng(`crown:${name}:${x}:${z}`)
      const canopyBottom = py - part.h * 0.5
      const lobes = name === 'scrub' ? 3 : 5
      for (let i = 0; i < lobes; i++) {
        const angle = i / lobes * Math.PI * 2 + ry
        const radial = i === 0 ? 0 : part.r * 0.42
        const cluster = {
          x: px + Math.cos(angle) * radial,
          y: canopyBottom + part.h * (i === 0 ? 0.63 : foliageRng.range(0.4, 0.6)),
          z: pz + Math.sin(angle) * radial,
          r: part.r * (i === 0 ? 0.74 : foliageRng.range(0.51, 0.65)),
          sy: part.h / (part.r * 2) * (i === 0 ? 1.12 : 0.9),
          color, seed: name,
        }
        emitBranch(target, atlas, {x:px,y:canopyBottom,z:pz}, {x:cluster.x,y:cluster.y,z:cluster.z}, name === 'scrub' ? 0.025 : 0.065)
        emitLeafCluster(atlas, cluster)
      }
      continue
    }

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
          caps: part.caps !== false,
        })
        break
      case 'cone':
        target.cone({ x: px, y: py, z: pz, r: part.r, h: part.h, seg, ry: pry, color, rect, emissive, flipY: !!part.flipY })
        break
      case 'sphere':
        target.sphere({ x: px, y: py, z: pz, r: part.r, seg: Math.max(8, seg), color, rect, emissive })
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
    // Recipe tilts (pipes, benches and vents) affect both geometry and normals.
    // Convert out of the prop yaw before tilting, then restore its world axes.
    if (part.rx || part.rz) {
      const cx = Math.cos(part.rx || 0), sx = Math.sin(part.rx || 0)
      const cz = Math.cos(part.rz || 0), sz = Math.sin(part.rz || 0)
      const c = Math.cos(ry), s = Math.sin(ry)
      const tilt = (vx, vy, vz) => {
        const lx = vx * c + vz * s, lz = -vx * s + vz * c
        const ty = vy * cx - lz * sx, tz = vy * sx + lz * cx
        const tx = lx * cz - ty * sz, yy = lx * sz + ty * cz
        return [tx * c - tz * s, yy, tx * s + tz * c]
      }
      for (let i = start; i < target.vertCount; i++) {
        const o = i * 3
        const p = tilt(target.pos[o] - px, target.pos[o + 1] - py, target.pos[o + 2] - pz)
        target.pos[o] = px + p[0]; target.pos[o + 1] = py + p[1]; target.pos[o + 2] = pz + p[2]
        const n = tilt(target.normals[o], target.normals[o + 1], target.normals[o + 2])
        target.normals[o] = n[0]; target.normals[o + 1] = n[1]; target.normals[o + 2] = n[2]
      }
    }
  }

  // Blob shadow — only for larger props (trees, carts, shelters). Tiny kerb
  // clutter does not need a second alpha quad each.
  if (def.castsBlob) {
    const r = def.collide?.r || 0
    const size = r ? r * 3.2 : 2.2
    if (size >= 1.6) {
      set.alpha.plane({ x, y: y + 0.04, z, w: size, d: size, color: '#000000', rect: atlas.uv('blob') })
    }
  }

  if (!def.collide) return null
  if (def.collide.type === 'circle') return { type: 'circle', x, z, r: def.collide.r, tag: name }
  if (def.collide.type === 'box') {
    return {
      type: 'box',
      x, z,
      hx: def.collide.w / 2,
      hz: def.collide.d / 2,
      ry,
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
  // Wider spacing = fewer high-seg streetlights (big tri sink with trees).
  const lightSpacing = district.id === 'yards' ? 56 : district.id === 'downtown' ? 38 : 36

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

      // One side of the street only on alternate steps — still reads as a row.
      const sides = (i % 2 === 0) ? [-1] : [1]
      for (const side of sides) {
        const ox = seg.horizontal ? 0 : side * (seg.halfWidth + sw * 0.55)
        const oz = seg.horizontal ? side * (seg.halfWidth + sw * 0.55) : 0
        const px = x + ox
        const pz = z + oz
        if (!inBounds(px, pz)) continue

        if (rng.chance(0.55)) {
          // Lamp head points at the road.
          const ry = seg.horizontal ? (side < 0 ? 0 : Math.PI) : side < 0 ? Math.PI / 2 : -Math.PI / 2
          const c = emitProp(set, atlas, propsData, lightName, px, 0, pz, ry, rng)
          if (c) colliders.push(c)
        }

        // Trees between the lights (district chance already high in Heights).
        if (trees.types.length && rng.chance(trees.chance * 0.32)) {
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
        if (rng.chance(0.16)) {
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

  // Traffic signals at major intersections only (degree ≥ 3 already).
  // One light + one walk signal per node instead of two of each.
  for (const node of graph.nodes.values()) {
    if (!inBounds(node.x, node.z)) continue
    if (node.edges.length < 3) continue
    let maxHw = 0
    for (const e of node.edges) maxHw = Math.max(maxHw, graph.halfWidthAt(e.lanes))
    const off = maxHw + sw * 0.5
    const c1 = emitProp(set, atlas, propsData, 'traffic-light', node.x - off, 0, node.z - off, 0, rng)
    if (c1) colliders.push(c1)
    const c2 = emitProp(set, atlas, propsData, 'crosswalk-signal', node.x + off, 0, node.z - off, Math.atan2(1, -1), rng)
    if (c2) colliders.push(c2)
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
