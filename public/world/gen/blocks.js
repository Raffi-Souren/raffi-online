/**
 * RAFFI WORLD — lot subdivision.
 *
 * Turns the land between roads into buildable lots. Under a fixed isometric
 * camera the city reads as a tile map, so lots are laid on the district's grid
 * rather than by polygon subdivision — it is far more reliable to generate and
 * far easier to audit from a screenshot.
 *
 * The density test from the spec lives here: change `density` for a district in
 * blocks.json and that district rebuilds denser, with no code change.
 */

import { makeRng } from '../engine/state.js'
import { isOnRoad, nearestRoad } from './roads.js'

/** Axis-aligned half extents for a lot rotated about Y. */
export function lotHalfExtents(lot) {
  const c = Math.abs(Math.cos(lot.ry || 0))
  const s = Math.abs(Math.sin(lot.ry || 0))
  return {
    hx: (lot.w * c + lot.d * s) / 2,
    hz: (lot.w * s + lot.d * c) / 2,
  }
}

function overlaps(a, b, pad = 0) {
  const ae = lotHalfExtents(a)
  const be = lotHalfExtents(b)
  return (
    Math.abs(a.x - b.x) < ae.hx + be.hx + pad &&
    Math.abs(a.z - b.z) < ae.hz + be.hz + pad
  )
}

function overlapsKeepout(lot, keepouts, margin) {
  const { hx, hz } = lotHalfExtents(lot)
  for (const k of keepouts) {
    if (
      lot.x + hx > k.minX - margin && lot.x - hx < k.maxX + margin &&
      lot.z + hz > k.minZ - margin && lot.z - hz < k.maxZ + margin
    ) return true
  }
  return false
}

function inWater(x, z, world) {
  for (const h of world.harbor || []) {
    if (x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) return true
  }
  const b = world.bounds
  return x < b.minX + 8 || x > b.maxX - 8 || z < b.minZ + 8 || z > b.maxZ - 8
}

function footprintInWater(lot, world) {
  const { hx, hz } = lotHalfExtents(lot)
  for (const h of world.harbor || []) {
    if (
      lot.x + hx > h.minX && lot.x - hx < h.maxX &&
      lot.z + hz > h.minZ && lot.z - hz < h.maxZ
    ) return true
  }
  const b = world.bounds
  return (
    lot.x - hx < b.minX + 8 || lot.x + hx > b.maxX - 8 ||
    lot.z - hz < b.minZ + 8 || lot.z + hz > b.maxZ - 8
  )
}

function insideDistrict(lot, district) {
  const { hx, hz } = lotHalfExtents(lot)
  const b = district.bounds
  return (
    lot.x - hx >= b.minX && lot.x + hx <= b.maxX &&
    lot.z - hz >= b.minZ && lot.z + hz <= b.maxZ
  )
}

/** True when a whole rotated footprint clears asphalt, sidewalk and padding. */
export function lotClearsRoads(lot, graph, margin) {
  const { hx, hz } = lotHalfExtents(lot)
  for (const segment of graph.segments) {
    if (segment.horizontal) {
      const minX = Math.min(segment.ax, segment.bx) - margin
      const maxX = Math.max(segment.ax, segment.bx) + margin
      const corridor = segment.halfWidth + margin
      const along = lot.x + hx > minX && lot.x - hx < maxX
      if (along && Math.abs(lot.z - segment.az) < hz + corridor) return false
    } else {
      const minZ = Math.min(segment.az, segment.bz) - margin
      const maxZ = Math.max(segment.az, segment.bz) + margin
      const corridor = segment.halfWidth + margin
      const along = lot.z + hz > minZ && lot.z - hz < maxZ
      if (along && Math.abs(lot.x - segment.ax) < hx + corridor) return false
    }
  }
  return true
}

/** Rotation whose local +Z facade points from a lot toward a road. */
export function ryForRoadSide(lot, segment) {
  if (!segment) return 0
  const closestX = segment.horizontal
    ? Math.max(Math.min(segment.ax, segment.bx), Math.min(lot.x, Math.max(segment.ax, segment.bx)))
    : segment.ax
  const closestZ = segment.horizontal
    ? segment.az
    : Math.max(Math.min(segment.az, segment.bz), Math.min(lot.z, Math.max(segment.az, segment.bz)))
  const dx = closestX - lot.x
  const dz = closestZ - lot.z
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? -Math.PI / 2 : Math.PI / 2
  return dz > 0 ? 0 : Math.PI
}

function orientAndNudge(lot, graph, roadMargin) {
  // A nudge can make an intersecting street become nearest. A second pass
  // resolves that corner case; final footprint validation rejects oscillation.
  for (let pass = 0; pass < 2; pass++) {
    const { segment } = nearestRoad(graph, lot.x, lot.z)
    if (!segment) break
    lot.ry = ryForRoadSide(lot, segment)
    const { hx, hz } = lotHalfExtents(lot)

    if (segment.horizontal) {
      const side = Math.sign(lot.z - segment.az) || 1
      const target = segment.halfWidth + roadMargin + hz + 0.05
      if (Math.abs(lot.z - segment.az) < target) lot.z = segment.az + side * target
    } else {
      const side = Math.sign(lot.x - segment.ax) || 1
      const target = segment.halfWidth + roadMargin + hx + 0.05
      if (Math.abs(lot.x - segment.ax) < target) lot.x = segment.ax + side * target
    }
  }

  const nearest = nearestRoad(graph, lot.x, lot.z)
  if (nearest.segment) lot.ry = ryForRoadSide(lot, nearest.segment)
  lot.streetDistance = nearest.distance
  return nearest
}

/**
 * @param district  entry from world.json districts
 * @param cfg       blocks.json
 * @param graph     road graph
 * @param world     world.json
 * @returns {Array} lots
 */
export function layoutLots(district, cfg, graph, world) {
  const dcfg = cfg.districts[district.id]
  if (!dcfg) return []

  const rng = makeRng('lots:' + district.id + ':' + world.seed)
  const lotting = cfg.lotting
  const keepouts = (world.landmarks || []).map((l) => l.keepout).filter(Boolean)
  const roadMargin = world.roadGraph.sidewalkWidth + lotting.blockPadding

  const lots = []
  const tile = dcfg.tileSize
  const b = district.bounds

  for (let x = b.minX + tile / 2; x <= b.maxX - tile / 2; x += tile) {
    for (let z = b.minZ + tile / 2; z <= b.maxZ - tile / 2; z += tile) {
      if (!rng.chance(dcfg.density)) continue

      const jx = x + rng.range(-tile * lotting.splitJitter, tile * lotting.splitJitter)
      const jz = z + rng.range(-tile * lotting.splitJitter, tile * lotting.splitJitter)

      const archetypeId = rng.weighted(dcfg.weights)
      const arch = cfg.archetypes[archetypeId]
      if (!arch) continue

      const fp = arch.footprint
      const w = rng.range(fp.wMin, fp.wMax)
      const d = rng.range(fp.dMin, fp.dMax)

      const lot = {
        id: `${district.id}-${lots.length}`,
        district: district.id,
        archetype: archetypeId,
        x: jx,
        z: jz,
        w,
        d,
        ry: 0,
        /** Distance to the street — drives whether it gets a stoop or signage. */
        streetDistance: Infinity,
        corner: false,
        seed: rng.int(0, 0xffffff),
      }

      const nearest = orientAndNudge(lot, graph, roadMargin)
      lot.corner = rng.chance(1 - lotting.cornerBias) && nearest.distance < roadMargin + 10

      // Validation happens after every displacement and uses the whole rotated
      // footprint. A centre point is not evidence that a building clears land.
      if (!insideDistrict(lot, district)) continue
      if (footprintInWater(lot, world)) continue
      if (overlapsKeepout(lot, keepouts, lotting.keepoutMargin)) continue
      if (!lotClearsRoads(lot, graph, roadMargin)) continue
      if (lots.some((other) => overlaps(lot, other, 2.0))) continue

      lots.push(lot)
    }
  }

  return lots
}

/** Every lot in the world, keyed by district. */
export function layoutAllLots(cfg, graph, world) {
  const out = new Map()
  for (const district of world.districts) {
    out.set(district.id, layoutLots(district, cfg, graph, world))
  }
  return out
}

/** Open ground (parking, lots, plazas) — anywhere in a district with no lot. */
export function findOpenSpots(district, lots, graph, world, count, seedTag, margin = 8) {
  const rng = makeRng('open:' + district.id + ':' + seedTag)
  const spots = []
  const b = district.bounds
  let guard = 0
  while (spots.length < count && guard++ < count * 40) {
    const x = rng.range(b.minX + 10, b.maxX - 10)
    const z = rng.range(b.minZ + 10, b.maxZ - 10)
    if (inWater(x, z, world)) continue
    if (isOnRoad(graph, x, z, 2)) continue
    let clash = false
    for (const lot of lots) {
      const { hx, hz } = lotHalfExtents(lot)
      if (Math.abs(x - lot.x) < hx + margin && Math.abs(z - lot.z) < hz + margin) { clash = true; break }
    }
    if (clash) continue
    spots.push({ x, z })
  }
  return spots
}
