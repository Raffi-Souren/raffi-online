/**
 * RAFFI WORLD — road network.
 *
 * Builds the node/edge graph from world.json's arterial spec, then generates
 * asphalt, sidewalks, curbs, lane paint and crosswalks from it. Nothing about
 * the layout is hardcoded: change `arterials.xs` and the city re-plans.
 *
 * Also exports the segment list that traffic and NPC pathing walk along.
 */

import { makeRng } from '../engine/state.js'

export const ROAD_Y = 0.02
export const SIDEWALK_Y = 0.22

function key(x, z) { return `${x}|${z}` }

function insideKeepout(x, z, keepouts, margin = 0) {
  for (const k of keepouts) {
    if (x >= k.minX - margin && x <= k.maxX + margin && z >= k.minZ - margin && z <= k.maxZ + margin) return true
  }
  return false
}

function inWater(x, z, world) {
  for (const h of world.harbor || []) {
    if (x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) return true
  }
  const b = world.bounds
  return x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ
}

/**
 * @returns {{nodes: Map, edges: Array, segments: Array, halfWidthAt: Function}}
 */
export function buildRoadGraph(world) {
  const rg = world.roadGraph
  const { xs, zs } = rg.arterials
  const suppress = new Set(rg.suppressNodes || [])
  const keepouts = (world.landmarks || []).map((l) => l.keepout).filter(Boolean)

  const nodes = new Map()
  for (const x of xs) {
    for (const z of zs) {
      const k = key(x, z)
      if (suppress.has(k)) continue
      if (inWater(x, z, world)) continue
      if (insideKeepout(x, z, keepouts)) continue
      nodes.set(k, { id: k, x, z, edges: [] })
    }
  }

  const wide = new Map()
  for (const w of rg.wideEdges || []) {
    wide.set(`${w.a}>${w.b}`, w.lanes)
    wide.set(`${w.b}>${w.a}`, w.lanes)
  }

  const edges = []
  const addEdge = (a, b, lanes, name) => {
    const na = nodes.get(a)
    const nb = nodes.get(b)
    if (!na || !nb) return
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return
    const e = {
      a, b, lanes,
      name: name || null,
      ax: na.x, az: na.z, bx: nb.x, bz: nb.z,
      length: Math.hypot(nb.x - na.x, nb.z - na.z),
      horizontal: Math.abs(na.z - nb.z) < 0.001,
    }
    edges.push(e)
    na.edges.push(e)
    nb.edges.push(e)
  }

  // Grid edges between adjacent arterials.
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      const a = key(xs[i], zs[j])
      if (i + 1 < xs.length) {
        const b = key(xs[i + 1], zs[j])
        addEdge(a, b, wide.get(`${a}>${b}`) || rg.defaultLanes, rg.streetNames?.zs?.[j])
      }
      if (j + 1 < zs.length) {
        const b = key(xs[i], zs[j + 1])
        addEdge(a, b, wide.get(`${a}>${b}`) || rg.defaultLanes, rg.streetNames?.xs?.[i])
      }
    }
  }

  for (const extra of rg.extraEdges || []) addEdge(extra.a, extra.b, extra.lanes, extra.name)

  const halfWidthAt = (lanes) => (lanes * rg.laneWidth) / 2

  // Walkable/drivable segment list for traffic and pathing.
  const segments = edges.map((e) => ({
    ...e,
    halfWidth: halfWidthAt(e.lanes),
    dirX: (e.bx - e.ax) / (e.length || 1),
    dirZ: (e.bz - e.az) / (e.length || 1),
  }))

  return { nodes, edges, segments, halfWidthAt, laneWidth: rg.laneWidth, sidewalkWidth: rg.sidewalkWidth }
}

/** True if a point is on asphalt (used to keep scenery and lots off the street). */
export function isOnRoad(graph, x, z, margin = 0) {
  for (const s of graph.segments) {
    if (s.horizontal) {
      const lo = Math.min(s.ax, s.bx) - margin
      const hi = Math.max(s.ax, s.bx) + margin
      if (x >= lo && x <= hi && Math.abs(z - s.az) <= s.halfWidth + margin) return true
    } else {
      const lo = Math.min(s.az, s.bz) - margin
      const hi = Math.max(s.az, s.bz) + margin
      if (z >= lo && z <= hi && Math.abs(x - s.ax) <= s.halfWidth + margin) return true
    }
  }
  return false
}

/** Distance from a point to the nearest road centreline, plus that segment. */
export function nearestRoad(graph, x, z) {
  let best = null
  let bestD = Infinity
  for (const s of graph.segments) {
    let d
    if (s.horizontal) {
      const cx = Math.max(Math.min(s.ax, s.bx), Math.min(x, Math.max(s.ax, s.bx)))
      d = Math.hypot(x - cx, z - s.az)
    } else {
      const cz = Math.max(Math.min(s.az, s.bz), Math.min(z, Math.max(s.az, s.bz)))
      d = Math.hypot(x - s.ax, z - cz)
    }
    if (d < bestD) { bestD = d; best = s }
  }
  return { segment: best, distance: bestD }
}

/**
 * Emits road geometry into a builder set.
 * @param set      builder set (opaque/emissive/alpha)
 * @param atlas    atlas helpers
 * @param graph    from buildRoadGraph
 * @param world    world.json
 * @param district optional district to restrict output to (streaming)
 */
export function buildRoadGeometry(set, atlas, graph, world, district = null) {
  const rng = makeRng('roads:' + (district?.id || 'all'))
  const b = set.opaque
  const road = atlas.uv('road')
  const walk = atlas.uv('sidewalk')
  const cobble = atlas.uv('cobble')
  const cross = atlas.uv('crosswalk')
  const lane = atlas.uv('lane')
  const rg = world.roadGraph
  const sw = rg.sidewalkWidth
  const curbH = rg.curbHeight

  const bounds = district?.bounds
  const inDistrict = (x, z) => {
    if (!bounds) return true
    const pad = 30
    return x >= bounds.minX - pad && x <= bounds.maxX + pad && z >= bounds.minZ - pad && z <= bounds.maxZ + pad
  }

  const walkTile = district?.id === 'heights' ? cobble : walk

  for (const s of graph.segments) {
    const midX = (s.ax + s.bx) / 2
    const midZ = (s.az + s.bz) / 2
    if (!inDistrict(midX, midZ)) continue

    const hw = s.halfWidth
    const len = s.length

    if (s.horizontal) {
      b.plane({ x: midX, y: ROAD_Y, z: s.az, w: len, d: hw * 2, color: '#ffffff', rect: road })
      // Sidewalks + curbs on both sides.
      for (const sign of [-1, 1]) {
        const cz = s.az + sign * (hw + sw / 2)
        b.plane({ x: midX, y: SIDEWALK_Y, z: cz, w: len, d: sw, color: '#ffffff', rect: walkTile })
        b.box({
          x: midX, y: curbH / 2, z: s.az + sign * hw, w: len, h: curbH, d: 0.35,
          color: '#b4b0a4', rect: atlas.uv('white'), faces: ['up', 'south', 'north'],
        })
      }
      // Centre dashes.
      const dashes = Math.max(1, Math.floor(len / 9))
      for (let i = 0; i < dashes; i++) {
        const t = (i + 0.5) / dashes
        const x = s.ax + (s.bx - s.ax) * t
        b.plane({ x, y: ROAD_Y + 0.01, z: s.az, w: 3.0, d: 0.28, color: '#ffffff', rect: lane })
      }
    } else {
      b.plane({ x: s.ax, y: ROAD_Y, z: midZ, w: hw * 2, d: len, color: '#ffffff', rect: road })
      for (const sign of [-1, 1]) {
        const cx = s.ax + sign * (hw + sw / 2)
        b.plane({ x: cx, y: SIDEWALK_Y, z: midZ, w: sw, d: len, color: '#ffffff', rect: walkTile })
        b.box({
          x: s.ax + sign * hw, y: curbH / 2, z: midZ, w: 0.35, h: curbH, d: len,
          color: '#b4b0a4', rect: atlas.uv('white'), faces: ['up', 'east', 'west'],
        })
      }
      const dashes = Math.max(1, Math.floor(len / 9))
      for (let i = 0; i < dashes; i++) {
        const t = (i + 0.5) / dashes
        const z = s.az + (s.bz - s.az) * t
        b.plane({ x: s.ax, y: ROAD_Y + 0.01, z, w: 0.28, d: 3.0, color: '#ffffff', rect: lane })
      }
    }
  }

  // Intersections: asphalt pad + four crosswalks.
  for (const node of graph.nodes.values()) {
    if (!inDistrict(node.x, node.z)) continue
    let maxHw = 0
    for (const e of node.edges) maxHw = Math.max(maxHw, graph.halfWidthAt(e.lanes))
    const pad = maxHw + 0.2
    set.opaque.plane({ x: node.x, y: ROAD_Y + 0.005, z: node.z, w: pad * 2, d: pad * 2, color: '#ffffff', rect: road })

    for (const e of node.edges) {
      const away = e.a === node.id
      const dx = away ? Math.sign(e.bx - e.ax) : Math.sign(e.ax - e.bx)
      const dz = away ? Math.sign(e.bz - e.az) : Math.sign(e.az - e.bz)
      const cwOffset = pad + 2.4
      if (dx !== 0) {
        set.opaque.plane({
          x: node.x + dx * cwOffset, y: ROAD_Y + 0.02, z: node.z,
          w: 3.2, d: maxHw * 2 - 0.6, color: '#ffffff', rect: cross,
        })
      } else if (dz !== 0) {
        set.opaque.plane({
          x: node.x, y: ROAD_Y + 0.02, z: node.z + dz * cwOffset,
          w: maxHw * 2 - 0.6, d: 3.2, color: '#ffffff', rect: cross, ry: Math.PI / 2,
        })
      }
    }
    void rng
  }
}
