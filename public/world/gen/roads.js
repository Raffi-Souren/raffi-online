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

/** Keep atlas grain at street scale; one stretched tile made whole blocks streak. */
export function emitSurfaceTiles(builder, surface, span = 24) {
  const nx = Math.ceil(surface.w / span)
  const nz = Math.ceil(surface.d / span)
  const w = surface.w / nx
  const d = surface.d / nz
  const c = Math.cos(surface.ry || 0)
  const s = Math.sin(surface.ry || 0)
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = -surface.w / 2 + (ix + 0.5) * w
      const z = -surface.d / 2 + (iz + 0.5) * d
      builder.plane({ ...surface, x: surface.x + x * c - z * s, z: surface.z + x * s + z * c, w, d })
    }
  }
}

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
  const addEdge = (a, b, lanes, name, style = {}) => {
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
      ...style,
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

  // Authored small streets join the same navigation graph as the arterials.
  // Split an arterial at each junction so vehicles can actually turn into it.
  const ensureJunction = (point) => {
    const id = key(point.x, point.z)
    if (nodes.has(id)) return id
    nodes.set(id, { id, x: point.x, z: point.z, edges: [] })
    for (const edge of [...edges]) {
      const onLine = edge.horizontal ? Math.abs(point.z - edge.az) < 0.001 : Math.abs(point.x - edge.ax) < 0.001
      const inside = edge.horizontal
        ? point.x > Math.min(edge.ax, edge.bx) && point.x < Math.max(edge.ax, edge.bx)
        : point.z > Math.min(edge.az, edge.bz) && point.z < Math.max(edge.az, edge.bz)
      if (!onLine || !inside) continue
      edges.splice(edges.indexOf(edge), 1)
      for (const endpoint of [edge.a, edge.b]) nodes.get(endpoint).edges = nodes.get(endpoint).edges.filter((e) => e !== edge)
      const style = { width: edge.width, sidewalkWidth: edge.sidewalkWidth, local: edge.local, curbCuts: edge.curbCuts }
      addEdge(edge.a, id, edge.lanes, edge.name, style)
      addEdge(id, edge.b, edge.lanes, edge.name, style)
    }
    return id
  }
  for (const street of rg.localStreets || []) {
    if (street.from.x !== street.to.x && street.from.z !== street.to.z) continue
    const a = ensureJunction(street.from), b = ensureJunction(street.to)
    addEdge(a, b, 1, street.name, { local: true, width: street.width, sidewalkWidth: street.sidewalkWidth, curbCuts: street.curbCuts || [] })
  }

  const halfWidthAt = (lanes) => (lanes * rg.laneWidth) / 2

  // Walkable/drivable segment list for traffic and pathing.
  const segments = edges.map((e) => ({
    ...e,
    halfWidth: e.width ? e.width / 2 : halfWidthAt(e.lanes),
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

/** A few utility repairs and catch basins belong to each authored local street.
 * They are flush surface geometry and never add navigation obstacles. */
function localStreetSurfaces(builder, atlas, segment, curbHeight) {
  const s = segment, lo = Math.min(s.horizontal ? s.ax : s.az, s.horizontal ? s.bx : s.bz)
  const plane = ({along,across,w,d,...rest}) => builder.plane({
    ...rest, x:s.horizontal?along:s.ax+across, z:s.horizontal?s.az+across:along,
    w:s.horizontal?w:d, d:s.horizontal?d:w,
  })
  const white = atlas.uv('white'), road = atlas.uv('road')
  for (const repair of [{t:0.24,across:-0.72,w:3.8,d:1.24},{t:0.63,across:1.03,w:2.7,d:1.65}]) {
    const along = lo+s.length*repair.t, {across,w,d} = repair
    plane({along,across,w,d,y:ROAD_Y+0.007,color:'#d0d1c9',rect:road})
    // Saw-cut tar seams, with a short worn corner instead of a repeated grid.
    for (const side of [-1,1]) {
      plane({along:along+side*w/2,across,w:0.032,d,y:ROAD_Y+0.01,color:'#29302d',rect:white})
      plane({along,across:across+side*d/2,w:w-(side===1?0.22:0),d:0.026,y:ROAD_Y+0.01,color:'#29302d',rect:white})
    }
  }
  for (const basin of [{t:0.28,side:1},{t:0.54,side:-1},{t:0.86,side:1}]) {
    const along = lo+s.length*basin.t, across = basin.side*(s.halfWidth-0.33)
    if ((s.curbCuts||[]).some(cut=>cut.side===basin.side && along>cut.from-0.5 && along<cut.to+0.5)) continue
    plane({along,across,w:0.91,d:0.55,y:ROAD_Y+0.009,color:'#737770',rect:white})
    plane({along,across,w:0.77,d:0.43,y:ROAD_Y+0.012,color:'#252d2a',rect:white})
    for (let bar=0;bar<9;bar++) plane({along:along-0.34+bar*0.085,across,w:0.025,d:0.45,y:ROAD_Y+0.014,color:'#626b63',rect:white})
  }
  for (const side of [-1,1]) for (let along=lo+9;along<lo+s.length-8;along+=6) {
    if ((s.curbCuts||[]).some(cut=>cut.side===side && along>cut.from-0.3 && along<cut.to+0.3)) continue
    plane({along,across:side*s.halfWidth,w:0.022,d:0.235,y:curbHeight+0.002,color:'#71766e',rect:white})
    if (Math.round(along-lo)%3===0) plane({along:along+0.07,across:side*(s.halfWidth-0.08),w:0.14,d:0.07,y:curbHeight+0.003,color:'#8f968a',rect:white})
  }
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
  const curbH = rg.curbHeight

  const bounds = district?.bounds
  const inDistrict = (x, z) => {
    if (!bounds) return true
    const pad = 30
    return x >= bounds.minX - pad && x <= bounds.maxX + pad && z >= bounds.minZ - pad && z <= bounds.maxZ + pad
  }

  const walkTile = walk
  void cobble

  for (const s of graph.segments) {
    const midX = (s.ax + s.bx) / 2
    const midZ = (s.az + s.bz) / 2
    if (!inDistrict(midX, midZ)) continue

    const hw = s.halfWidth
    const len = s.length
    const sw = s.sidewalkWidth ?? rg.sidewalkWidth
    const lo = Math.min(s.horizontal ? s.ax : s.az, s.horizontal ? s.bx : s.bz)
    const hi = lo + len
    const junctionTrim = (id) => Math.max(0, ...graph.nodes.get(id).edges.filter((edge) => edge.horizontal !== s.horizontal).map((edge) => (edge.width ? edge.width / 2 : graph.halfWidthAt(edge.lanes)) + 0.2))
    const startId = (s.horizontal ? s.ax <= s.bx : s.az <= s.bz) ? s.a : s.b
    const endId = startId === s.a ? s.b : s.a
    const spansFor = (sign) => {
      let spans = [[lo + junctionTrim(startId), hi - junctionTrim(endId)]]
      for (const cut of s.curbCuts || []) {
        if (cut.side !== sign) continue
        spans = spans.flatMap(([a, b]) => cut.to <= a || cut.from >= b ? [[a, b]] : [[a, Math.max(a, cut.from)], [Math.min(b, cut.to), b]])
      }
      return spans.filter(([a, b]) => b - a > 0.01)
    }

    if (s.horizontal) {
      emitSurfaceTiles(b, { x: midX, y: ROAD_Y, z: s.az, w: len, d: hw * 2, color: '#ffffff', rect: road })
      // Sidewalks + curbs on both sides.
      for (const sign of [-1, 1]) {
        const cz = s.az + sign * (hw + sw / 2)
        for (const [a, end] of spansFor(sign)) {
          emitSurfaceTiles(b, { x: (a + end) / 2, y: SIDEWALK_Y, z: cz, w: end - a, d: sw, color: '#ffffff', rect: walkTile }, 12)
          b.box({ x: (a + end) / 2, y: curbH / 2, z: s.az + sign * hw, w: end - a, h: curbH, d: 0.24,
            color: '#b4b0a4', rect: atlas.uv('white'), faces: ['up', 'south', 'north'] })
        }
      }
      // Centre dashes.
      const dashes = Math.max(1, Math.floor(len / 9))
      for (let i = 0; !s.local && i < dashes; i++) {
        const t = (i + 0.5) / dashes
        const x = s.ax + (s.bx - s.ax) * t
        b.plane({ x, y: ROAD_Y + 0.01, z: s.az, w: 3.0, d: 0.28, color: '#ffffff', rect: lane })
      }
    } else {
      emitSurfaceTiles(b, { x: s.ax, y: ROAD_Y, z: midZ, w: hw * 2, d: len, color: '#ffffff', rect: road })
      for (const sign of [-1, 1]) {
        const cx = s.ax + sign * (hw + sw / 2)
        for (const [a, end] of spansFor(sign)) {
          emitSurfaceTiles(b, { x: cx, y: SIDEWALK_Y, z: (a + end) / 2, w: sw, d: end - a, color: '#ffffff', rect: walkTile }, 12)
          b.box({ x: s.ax + sign * hw, y: curbH / 2, z: (a + end) / 2, w: 0.24, h: curbH, d: end - a,
            color: '#b4b0a4', rect: atlas.uv('white'), faces: ['up', 'east', 'west'] })
        }
      }
      const dashes = Math.max(1, Math.floor(len / 9))
      for (let i = 0; !s.local && i < dashes; i++) {
        const t = (i + 0.5) / dashes
        const z = s.az + (s.bz - s.az) * t
        b.plane({ x: s.ax, y: ROAD_Y + 0.01, z, w: 0.28, d: 3.0, color: '#ffffff', rect: lane })
      }
    }
    if (s.local) localStreetSurfaces(b, atlas, s, curbH)
  }

  // Intersections: asphalt pad + four crosswalks.
  for (const node of graph.nodes.values()) {
    if (!inDistrict(node.x, node.z)) continue
    let maxHw = 0
    for (const e of node.edges) maxHw = Math.max(maxHw, e.width ? e.width / 2 : graph.halfWidthAt(e.lanes))
    const pad = maxHw + 0.2
    set.opaque.plane({ x: node.x, y: ROAD_Y + 0.005, z: node.z, w: pad * 2, d: pad * 2, color: '#ffffff', rect: road })

    for (const e of node.edges.length >= 3 ? node.edges : []) {
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
