/**
 * RAFFI WORLD — the shape grammar.
 *
 * footprint → extrude → setback → cap → window grid → rooftop props.
 *
 * Window grids come from the atlas rather than from geometry: each facade cell
 * carries a painted 6x8 grid and a wall samples the sub-rect it needs. Lit
 * windows are then added as a handful of separate emissive quads, which is what
 * makes the night grade read without a single realtime light.
 */

import { makeRng } from '../engine/state.js'
import { FACADE_BAYS, FACADE_FLOORS } from './atlas.js'
import { lotHalfExtents } from './blocks.js'

const SIDES = ['south', 'north', 'east', 'west']

function facadeTile(atlas, facade) { return atlas.uv('wall/' + facade) }
function flatTile(atlas, facade) { return atlas.uv('flat/' + facade) }

/** Local right (+X) and facade/front (+Z) axes for a rotated lot. */
export function lotAxes(lot) {
  const c = Math.cos(lot.ry || 0)
  const s = Math.sin(lot.ry || 0)
  return {
    right: { x: c, z: s },
    front: { x: -s, z: c },
  }
}

/** Converts a point in lot-local X/Z into world space. */
export function lotPoint(lot, localX, localZ) {
  const { right, front } = lotAxes(lot)
  return {
    x: lot.x + right.x * localX + front.x * localZ,
    z: lot.z + right.z * localX + front.z * localZ,
  }
}

/**
 * Emits one building.
 * @returns {object} collider box for physics
 */
export function buildBuilding(set, atlas, lot, cfg, opts = {}) {
  const arch = cfg.archetypes[lot.archetype]
  const dcfg = cfg.districts[lot.district]
  const rng = makeRng('bld:' + lot.id + ':' + lot.seed)
  const b = set.opaque

  const facade = rng.pick(arch.facade)
  const wallRect = facadeTile(atlas, facade)
  const flatRect = flatTile(atlas, facade)
  const wallColor = '#ffffff' // tint comes from the painted tile, not the vertex

  const floors = Math.max(1, Math.round(rng.int(arch.floors.min, arch.floors.max) * (dcfg?.heightScale ?? 1)))
  const fh = arch.floorHeight
  const totalH = floors * fh

  // UV sub-rect: how much of the painted 6x8 window grid this wall shows.
  const bays = Math.max(1, Math.min(FACADE_BAYS, Math.round(lot.w / (arch.windows?.colsPer || 3.5))))
  const su = bays / FACADE_BAYS
  const sv = Math.min(1, floors / FACADE_FLOORS)

  let w = lot.w
  let d = lot.d
  let y = 0

  const shells = []

  // ----------------------------------------------------------- extrude ---
  const setback = arch.setback || { mode: 'none' }
  if (setback.mode === 'stepped') {
    const steps = setback.steps || 3
    const per = totalH / steps
    for (let i = 0; i < steps; i++) {
      shells.push({ y: y + per / 2, h: per, w, d })
      y += per
      w *= 1 - setback.inset
      d *= 1 - setback.inset
    }
  } else if (setback.mode === 'single') {
    const lowH = totalH * setback.atFraction
    const highH = totalH - lowH
    shells.push({ y: lowH / 2, h: lowH, w, d })
    const w2 = w * (1 - setback.inset)
    const d2 = d * (1 - setback.inset)
    shells.push({ y: lowH + highH / 2, h: highH, w: w2, d: d2 })
    w = w2
    d = d2
    y = totalH
  } else {
    shells.push({ y: totalH / 2, h: totalH, w, d })
    y = totalH
  }

  for (const s of shells) {
    const shellSv = Math.min(1, (s.h / fh) / FACADE_FLOORS)
    b.box({
      x: lot.x, y: s.y, z: lot.z, w: s.w, h: s.h, d: s.d, ry: lot.ry,
      color: wallColor, rect: wallRect, su, sv: shellSv,
      faces: SIDES,
      topRect: flatRect,
    })
  }

  // Roof slab (only the top shell needs one).
  const top = shells[shells.length - 1]
  const roofY = top.y + top.h / 2
  b.plane({ x: lot.x, y: roofY, z: lot.z, w: top.w, d: top.d, ry: lot.ry, color: '#ffffff', rect: flatRect })

  // --------------------------------------------------------------- cap ---
  const cap = arch.cap || { type: 'parapet', height: 0.6 }
  const capColor = '#ffffff'
  switch (cap.type) {
    case 'cornice':
      b.box({
        x: lot.x, y: roofY + cap.height / 2, z: lot.z,
        w: top.w + (cap.overhang || 0.4) * 2, h: cap.height, d: top.d + (cap.overhang || 0.4) * 2,
        ry: lot.ry, color: capColor, rect: flatRect, faces: [...SIDES, 'up'],
      })
      break
    case 'parapet':
      b.box({
        x: lot.x, y: roofY + cap.height / 2, z: lot.z,
        w: top.w + (cap.overhang || 0.15) * 2, h: cap.height, d: top.d + (cap.overhang || 0.15) * 2,
        ry: lot.ry, color: capColor, rect: flatRect, faces: [...SIDES, 'up'],
      })
      break
    case 'mech-box':
      b.box({
        x: lot.x, y: roofY + cap.height / 2, z: lot.z,
        w: top.w * (1 - (cap.inset || 0.3)), h: cap.height, d: top.d * (1 - (cap.inset || 0.3)),
        ry: lot.ry, color: '#ffffff', rect: flatRect, faces: [...SIDES, 'up'],
      })
      break
    case 'crown': {
      const steps = 3
      let cw = top.w
      let cd = top.d
      let cy = roofY
      for (let i = 0; i < steps; i++) {
        const h = cap.height / steps
        b.box({ x: lot.x, y: cy + h / 2, z: lot.z, w: cw, h, d: cd, ry: lot.ry, color: capColor, rect: flatRect, faces: [...SIDES, 'up'] })
        cy += h
        cw *= 1 - (cap.inset || 0.4) / steps
        cd *= 1 - (cap.inset || 0.4) / steps
      }
      break
    }
    case 'sawtooth': {
      const teeth = cap.teeth || 5
      const tw = top.w / teeth
      for (let i = 0; i < teeth; i++) {
        const ox = -top.w / 2 + tw * (i + 0.5)
        const px = lot.x + ox * Math.cos(lot.ry)
        const pz = lot.z + ox * Math.sin(lot.ry)
        b.wedge({ x: px, y: roofY + cap.height / 2, z: pz, w: tw * 0.94, h: cap.height, d: top.d * 0.9, ry: lot.ry, color: capColor, rect: flatRect })
      }
      break
    }
    case 'gable':
      b.wedge({ x: lot.x, y: roofY + cap.height / 2, z: lot.z, w: top.w, h: cap.height, d: top.d, ry: lot.ry, color: capColor, rect: flatRect })
      break
    case 'open-deck':
      b.box({ x: lot.x, y: roofY + cap.height / 2, z: lot.z, w: top.w, h: cap.height, d: top.d, ry: lot.ry, color: '#ffffff', rect: flatRect, faces: [...SIDES, 'up'] })
      break
    default:
      break
  }

  // ------------------------------------------------------------- stoop ---
  if (arch.stoop && rng.chance(arch.stoop.chance)) {
    const sd = arch.stoop.depth
    const sw = arch.stoop.width
    const steps = arch.stoop.steps
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const h = 1.1 * (1 - t)
      const off = sd * (t + 0.5 / steps)
      const p = lotPoint(lot, 0, lot.d / 2 + off)
      b.box({
        x: p.x, y: h / 2, z: p.z,
        w: sw, h, d: sd / steps, ry: lot.ry,
        color: '#9a958c', rect: atlas.uv('white'), faces: ['up', ...SIDES],
      })
    }
  }

  // ------------------------------------------------- ground floor retail ---
  const ground = arch.ground
  if (ground && ground.type === 'retail') {
    const face = lotPoint(lot, 0, lot.d / 2 + 0.06)

    if (rng.chance(ground.signChance ?? 0.8)) {
      const shopIdx = rng.int(0, (opts.shopCount || 10) - 1)
      set.emissive.billboard({
        x: face.x, y: fh * 0.86, z: face.z, w: lot.w * 0.7, h: 1.15,
        ry: lot.ry, color: '#ffffff', rect: atlas.uv('shop-' + shopIdx), emissive: true,
      })
    }
    if (rng.chance(ground.awningChance ?? 0.5)) {
      const aw = lot.w * 0.78
      const p = lotPoint(lot, 0, lot.d / 2 + 0.56)
      b.box({
        x: p.x, y: fh * 0.62, z: p.z,
        w: aw, h: 0.14, d: 1.1, ry: lot.ry,
        color: rng.pick(['#8a3a3a', '#2e5a6e', '#3a5a3a', '#6e5a2e']),
        rect: atlas.uv('white'), faces: ['up', 'down', ...SIDES],
      })
    }
  }

  // ------------------------------------------------------------- neon ---
  if (arch.neon && rng.chance(arch.neon.chance)) {
    const color = rng.pick(arch.neon.palette)
    const p = lotPoint(lot, 0, lot.d / 2 + 0.12)
    set.emissive.billboard({
      x: p.x,
      y: totalH * 0.72,
      z: p.z,
      w: lot.w * 0.5, h: 2.4, ry: lot.ry,
      color, rect: atlas.uv('white'), emissive: true,
    })
  }

  // ------------------------------------------------------ lit windows ---
  // Only on the two faces the fixed camera can see at the default yaw, and
  // capped hard — this is the single easiest place to blow the triangle budget.
  const litChance = arch.windows?.litChance?.[opts.grade || 'dusk'] ?? 0.3
  if (litChance > 0.01) {
    const litRect = atlas.uv('litwindow')
    const maxLit = Math.min(10, Math.round(floors * bays * litChance * 0.5))
    for (let i = 0; i < maxLit; i++) {
      const f = rng.int(0, floors - 1)
      const bay = rng.int(0, bays - 1)
      const side = rng.chance(0.5) ? 1 : -1
      const along = (-0.5 + (bay + 0.5) / bays) * lot.w
      const wy = f * fh + fh * 0.55
      if (wy > totalH - 0.4) continue
      const outward = lot.d / 2 + 0.07
      const p = lotPoint(lot, along, side * outward)
      set.emissive.billboard({
        x: p.x, y: wy, z: p.z,
        w: 1.0, h: 0.86,
        ry: lot.ry + (side < 0 ? Math.PI : 0),
        color: rng.pick(['#ffe9b8', '#ffd98a', '#d8e4ff', '#ffcf9a']),
        rect: litRect, emissive: true,
      })
    }
  }

  // ------------------------------------------------------- roof props ---
  const rp = arch.roofProps
  const roofProps = []
  if (rp && rng.chance(rp.chance)) {
    const n = rng.int(1, rp.max)
    for (let i = 0; i < n; i++) {
      const p = lotPoint(lot, rng.range(-top.w * 0.3, top.w * 0.3), rng.range(-top.d * 0.3, top.d * 0.3))
      roofProps.push({
        type: rng.pick(rp.types),
        x: p.x,
        z: p.z,
        y: roofY + (cap.height || 0),
        ry: rng.range(0, Math.PI * 2),
      })
    }
  }

  const extents = lotHalfExtents(lot)
  return {
    collider: {
      type: 'box',
      x: lot.x,
      z: lot.z,
      hx: extents.hx,
      hz: extents.hz,
      height: totalH,
      tag: 'building',
    },
    roofProps,
    height: totalH,
    floors,
  }
}

/** Builds every lot in a district. Returns colliders + queued roof props. */
export function buildDistrictBuildings(set, atlas, lots, cfg, opts) {
  const colliders = []
  const roofProps = []
  for (const lot of lots) {
    const out = buildBuilding(set, atlas, lot, cfg, opts)
    colliders.push(out.collider)
    for (const p of out.roofProps) roofProps.push(p)
  }
  return { colliders, roofProps }
}
