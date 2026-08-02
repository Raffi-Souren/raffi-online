/**
 * RAFFI WORLD — building shape grammar (InfiniTown-inspired massing).
 *
 * High-leverage reads that kill "Minecraft cube" without blur:
 *   1. base / shaft / crown shells (different widths + heights)
 *   2. storey ledges + optional pilasters
 *   3. punched window recesses (ordered grid)
 *   4. ground storefront band for retail
 *   5. layered cornice / parapet / mech crown
 *
 * Window *textures* still come from the atlas; geometry sells depth.
 */

import { makeRng } from '../engine/state.js'
import { FACADE_BAYS, FACADE_FLOORS } from './atlas.js'
import { lotHalfExtents } from './blocks.js'

const SIDES = ['south', 'north', 'east', 'west']
const SIDES_TOP = [...SIDES, 'up']
const SIDES_ALL = [...SIDES, 'up', 'down']

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
 * Plan stacked shells: optional plinth, then shaft with setbacks.
 * InfiniTown / classic city silhouette = not one extruded box.
 */
function planShells(arch, lot, floors, fh) {
  const m = arch.massing || {}
  const setback = arch.setback || { mode: 'none' }
  const shells = []

  // Single-floor sheds / warehouses skip plinth.
  const wantBase = floors >= 2 && m.baseFloors !== 0 && setback.mode !== 'deck'
  const baseFloors = wantBase
    ? Math.min(floors - 1, Math.max(1, m.baseFloors ?? 1))
    : 0
  const baseScale = m.baseHeightScale ?? 1.2
  const baseOut = m.baseOutset ?? 0.14
  const baseH = baseFloors * fh * baseScale
  const upperFloors = floors - baseFloors
  const upperH = Math.max(fh, upperFloors * fh)
  const totalH = baseH + upperH

  let w = lot.w
  let d = lot.d
  let y = 0

  if (baseFloors > 0) {
    shells.push({
      y: baseH / 2,
      h: baseH,
      w: w + baseOut * 2,
      d: d + baseOut * 2,
      role: 'base',
      floors: baseFloors,
      floorH: baseH / baseFloors,
    })
    y = baseH
  }

  // Shaft / tower setbacks apply only to the upper mass.
  if (setback.mode === 'stepped' && upperFloors > 1) {
    const steps = Math.min(setback.steps || 3, Math.max(2, upperFloors))
    const per = upperH / steps
    let sw = w
    let sd = d
    for (let i = 0; i < steps; i++) {
      shells.push({
        y: y + per / 2,
        h: per,
        w: sw,
        d: sd,
        role: i === steps - 1 ? 'crown' : 'shaft',
        floors: Math.max(1, Math.round(per / fh)),
        floorH: fh,
      })
      y += per
      sw *= 1 - (setback.inset || 0.12)
      sd *= 1 - (setback.inset || 0.12)
    }
  } else if (setback.mode === 'single' && upperH > fh * 2) {
    const lowFrac = setback.atFraction ?? 0.72
    const lowH = upperH * lowFrac
    const highH = upperH - lowH
    shells.push({
      y: y + lowH / 2, h: lowH, w, d, role: 'shaft',
      floors: Math.max(1, Math.round(lowH / fh)), floorH: fh,
    })
    const w2 = w * (1 - (setback.inset || 0.14))
    const d2 = d * (1 - (setback.inset || 0.14))
    shells.push({
      y: y + lowH + highH / 2, h: highH, w: w2, d: d2, role: 'crown',
      floors: Math.max(1, Math.round(highH / fh)), floorH: fh,
    })
    y = totalH
  } else if (upperFloors > 0 || baseFloors === 0) {
    const h = baseFloors > 0 ? upperH : totalH || floors * fh
    const startY = baseFloors > 0 ? baseH : 0
    shells.push({
      y: startY + h / 2,
      h,
      w,
      d,
      role: 'shaft',
      floors: Math.max(1, upperFloors || floors),
      floorH: fh,
    })
  }

  return { shells, totalH: shells.length
    ? Math.max(...shells.map((s) => s.y + s.h / 2))
    : floors * fh }
}

/**
 * Emits one building.
 * @returns {object} collider box for physics
 */
export function buildBuilding(set, atlas, lot, cfg, opts = {}) {
  const arch = cfg.archetypes[lot.archetype]
  if (!arch) {
    return {
      collider: { type: 'box', x: lot.x, z: lot.z, hx: lot.w / 2, hz: lot.d / 2, height: 4, tag: 'building' },
      roofProps: [],
      height: 4,
      floors: 1,
    }
  }
  const dcfg = cfg.districts[lot.district]
  const rng = makeRng('bld:' + lot.id + ':' + lot.seed)
  const b = set.opaque
  const m = arch.massing || {}

  const facade = rng.pick(arch.facade)
  const wallRect = facadeTile(atlas, facade)
  const flatRect = flatTile(atlas, facade)
  const wallColor = '#ffffff'
  // Slightly darker base mass — InfiniTown-style plinth read.
  const baseColor = m.baseColor || '#e8e4dc'
  const ledgeColor = m.ledgeColor || '#d4cfc4'
  const frameColor = m.frameColor || '#cfc8bc'

  const floors = Math.max(1, Math.round(rng.int(arch.floors.min, arch.floors.max) * (dcfg?.heightScale ?? 1)))
  const fh = arch.floorHeight
  const { shells, totalH } = planShells(arch, lot, floors, fh)

  const bays = Math.max(1, Math.min(FACADE_BAYS, Math.round(lot.w / (arch.windows?.colsPer || 3.5))))
  const su = bays / FACADE_BAYS

  // ----------------------------------------------------------- shells ---
  for (const s of shells) {
    const shellSv = Math.min(1, (s.h / fh) / FACADE_FLOORS)
    const isBase = s.role === 'base'
    b.box({
      x: lot.x, y: s.y, z: lot.z, w: s.w, h: s.h, d: s.d, ry: lot.ry,
      color: isBase ? baseColor : wallColor,
      rect: isBase ? flatRect : wallRect,
      su: isBase ? 1 : su,
      sv: shellSv,
      faces: SIDES,
      topRect: flatRect,
    })

    // Storey ledges (skip parking decks and 1-floor boxes).
    if (m.belts !== false && s.h > fh * 1.1 && arch.cap?.type !== 'open-deck') {
      addStoreyBelts(b, lot, s, ledgeColor, flatRect)
    }

    // Corner pilasters on brownstone-like stock.
    if (m.pilasters && s.role !== 'crown') {
      addPilasters(b, lot, s, frameColor, flatRect, bays)
    }
  }

  const top = shells[shells.length - 1]
  const roofY = top.y + top.h / 2
  // Roof deck slightly inset so the cornice / parapet can overshoot.
  b.plane({
    x: lot.x, y: roofY + 0.02, z: lot.z,
    w: top.w * 0.98, d: top.d * 0.98, ry: lot.ry,
    color: '#b8b4ac', rect: flatRect,
  })

  // ---------------------------------------------------------- windows ---
  const winStyle = m.windowStyle || (arch.windows?.tile?.includes('curtain') ? 'curtain' : 'recessed')
  if (winStyle !== 'none' && arch.cap?.type !== 'open-deck') {
    addWindowGrid(b, atlas, lot, {
      shells, floors, fh, bays, totalH, rng, frameColor,
      style: winStyle,
      skipGround: !!(arch.ground && arch.ground.type === 'retail'),
    })
  }

  // Parking structure: open horizontal bands instead of punched windows.
  if (arch.cap?.type === 'open-deck') {
    addDeckBands(b, lot, shells, fh, flatRect)
  }

  // --------------------------------------------------------------- cap ---
  const cap = arch.cap || { type: 'parapet', height: 0.6 }
  addCap(b, lot, top, roofY, cap, flatRect, rng)

  // ------------------------------------------------------------- stoop ---
  if (arch.stoop && rng.chance(arch.stoop.chance)) {
    addStoop(b, lot, arch.stoop, atlas)
  }

  // ------------------------------------------------- ground floor retail ---
  const ground = arch.ground
  if (ground && ground.type === 'retail') {
    addStorefront(b, set, atlas, lot, {
      fh: shells[0]?.role === 'base' ? shells[0].h : fh,
      ground, rng, shopCount: opts.shopCount || 10, frameColor,
    })
  } else if (ground && ground.type === 'roll-door') {
    addRollDoors(b, lot, ground, atlas, rng)
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
  const litChance = arch.windows?.litChance?.[opts.grade || 'dusk'] ?? 0.3
  if (litChance > 0.01 && winStyle !== 'none') {
    addLitWindows(set, atlas, lot, {
      floors, fh, bays, totalH, litChance, rng, shells,
    })
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

// ---------------------------------------------------------------- pieces ---

function addStoreyBelts(b, lot, s, color, rect) {
  const shellBot = s.y - s.h / 2
  const shellTop = s.y + s.h / 2
  const step = s.floorH || 3.6
  const beltH = Math.min(0.2, step * 0.06)
  const out = 0.14
  for (let y = shellBot + step; y < shellTop - 0.35; y += step) {
    b.box({
      x: lot.x, y, z: lot.z,
      w: s.w + out * 2, h: beltH, d: s.d + out * 2,
      ry: lot.ry, color, rect, faces: SIDES_ALL,
    })
  }
}

function addPilasters(b, lot, s, color, rect, bays) {
  // Corner posts + mid pilasters on the street face (rowhouse / brownstone read).
  const pw = 0.28
  const out = 0.08
  const posts = [
    { x: s.w / 2 + out, z: s.d / 2 + out },
    { x: -s.w / 2 - out, z: s.d / 2 + out },
    { x: s.w / 2 + out, z: -s.d / 2 - out },
    { x: -s.w / 2 - out, z: -s.d / 2 - out },
  ]
  for (const post of posts) {
    const p = lotPoint(lot, post.x, post.z)
    b.box({
      x: p.x, y: s.y, z: p.z,
      w: pw, h: s.h * 0.98, d: pw,
      ry: lot.ry, color, rect, faces: SIDES_TOP,
    })
  }

  if (bays >= 3) {
    for (let i = 1; i < bays; i++) {
      const lx = (-0.5 + i / bays) * s.w
      const p = lotPoint(lot, lx, s.d / 2 + out)
      b.box({
        x: p.x, y: s.y, z: p.z,
        w: pw * 0.7, h: s.h * 0.96, d: pw * 0.55,
        ry: lot.ry, color, rect, faces: SIDES,
      })
    }
  }
}

function addWindowGrid(b, atlas, lot, ctx) {
  const { shells, fh, bays, totalH, rng, frameColor, style, skipGround } = ctx
  const darkPane = style === 'curtain' ? '#1c2a38' : '#1a2230'
  const paneRect = atlas.uv(style === 'curtain' ? 'flat/glass-blue' : 'litwindow') || atlas.uv('white')
  const white = atlas.uv('white')

  let placed = 0
  const maxPlaced = Math.min(48, Math.round(totalH / fh) * bays * 1.6)

  for (const s of shells) {
    if (s.role === 'base' && skipGround) continue
    const shellBot = s.y - s.h / 2
    const shellTop = s.y + s.h / 2
    const step = s.floorH || fh
    const faceBays = Math.max(1, Math.round(s.w / (s.w / bays || 3.5)))
    const bayW = s.w / faceBays
    const winW = style === 'curtain'
      ? Math.min(bayW * 0.78, 3.2)
      : Math.min(bayW * 0.52, 2.2)
    const winH = style === 'curtain'
      ? Math.min(step * 0.72, 2.6)
      : Math.min(step * 0.46, 1.65)
    const depth = style === 'curtain' ? 0.12 : 0.2

    // Street faces (local ±Z) always; sides if wide enough.
    const faces = [
      { axis: 'z', sign: 1, span: s.w },
      { axis: 'z', sign: -1, span: s.w },
    ]
    if (s.w >= 16) {
      faces.push(
        { axis: 'x', sign: 1, span: s.d },
        { axis: 'x', sign: -1, span: s.d },
      )
    }

    for (const face of faces) {
      const nBays = face.axis === 'z'
        ? faceBays
        : Math.max(1, Math.round(s.d / Math.max(bayW, 2.5)))
      for (let f = 0; ; f++) {
        const y = shellBot + step * (f + 0.55)
        if (y > shellTop - 0.45) break
        if (y > totalH - 0.5) break

        for (let i = 0; i < nBays; i++) {
          if (placed >= maxPlaced) return
          if (rng.chance(style === 'curtain' ? 0.04 : 0.1)) continue

          const t = (-0.5 + (i + 0.5) / nBays) * face.span
          let localX = 0
          let localZ = 0
          if (face.axis === 'z') {
            localX = t
            localZ = face.sign * (s.d / 2 - depth * 0.45)
          } else {
            localZ = t
            localX = face.sign * (s.w / 2 - depth * 0.45)
          }
          const p = lotPoint(lot, localX, localZ)

          b.box({
            x: p.x, y, z: p.z,
            w: face.axis === 'z' ? winW : depth,
            h: winH,
            d: face.axis === 'z' ? depth : winW,
            ry: lot.ry,
            color: darkPane,
            rect: paneRect,
            faces: SIDES,
          })

          // Sill + lintel only (cheap frame that still sells depth).
          if (style !== 'curtain') {
            const lip = 0.07
            let flx = localX
            let flz = localZ
            if (face.axis === 'z') flz = face.sign * (s.d / 2 + 0.02)
            else flx = face.sign * (s.w / 2 + 0.02)
            const fp = lotPoint(lot, flx, flz)
            // lintel
            b.box({
              x: fp.x, y: y + winH * 0.5 + lip * 0.5, z: fp.z,
              w: face.axis === 'z' ? winW + lip * 2 : 0.1,
              h: lip,
              d: face.axis === 'z' ? 0.1 : winW + lip * 2,
              ry: lot.ry, color: frameColor, rect: white, faces: SIDES_TOP,
            })
            // sill
            b.box({
              x: fp.x, y: y - winH * 0.5 - lip * 0.35, z: fp.z,
              w: face.axis === 'z' ? winW + lip * 1.5 : 0.1,
              h: lip * 0.7,
              d: face.axis === 'z' ? 0.12 : winW + lip * 1.5,
              ry: lot.ry, color: frameColor, rect: white, faces: SIDES_TOP,
            })
          }

          placed++
        }
      }
    }
  }
}

function addDeckBands(b, lot, shells, fh, rect) {
  for (const s of shells) {
    const bot = s.y - s.h / 2
    const top = s.y + s.h / 2
    for (let y = bot + fh * 0.5; y < top - 0.2; y += fh) {
      // Dark open band on long faces.
      for (const sign of [1, -1]) {
        const p = lotPoint(lot, 0, sign * (s.d / 2 + 0.04))
        b.box({
          x: p.x, y, z: p.z,
          w: s.w * 0.92, h: fh * 0.42, d: 0.12,
          ry: lot.ry, color: '#1a1c20', rect, faces: SIDES,
        })
      }
    }
  }
}

function addCap(b, lot, top, roofY, cap, rect, rng) {
  const capColor = '#ebe6dc'
  const dark = '#9a968e'
  switch (cap.type) {
    case 'cornice': {
      // Double cornice: thick band + thin overhang (InfiniTown roof line).
      const h = cap.height || 0.9
      const over = cap.overhang || 0.45
      b.box({
        x: lot.x, y: roofY + h * 0.35, z: lot.z,
        w: top.w + over * 0.6, h: h * 0.55, d: top.d + over * 0.6,
        ry: lot.ry, color: capColor, rect, faces: SIDES_TOP,
      })
      b.box({
        x: lot.x, y: roofY + h * 0.85, z: lot.z,
        w: top.w + over * 2, h: h * 0.28, d: top.d + over * 2,
        ry: lot.ry, color: dark, rect, faces: SIDES_TOP,
      })
      break
    }
    case 'parapet': {
      const h = cap.height || 0.8
      const over = cap.overhang || 0.15
      // Raised ring parapet — four walls + slight top lip.
      b.box({
        x: lot.x, y: roofY + h / 2, z: lot.z,
        w: top.w + over * 2, h, d: top.d + over * 2,
        ry: lot.ry, color: capColor, rect, faces: SIDES_TOP,
      })
      break
    }
    case 'mech-box': {
      const h = cap.height || 5
      const inset = cap.inset || 0.3
      b.box({
        x: lot.x, y: roofY + h / 2, z: lot.z,
        w: top.w * (1 - inset), h, d: top.d * (1 - inset),
        ry: lot.ry, color: '#c8cdd2', rect, faces: SIDES_TOP,
      })
      // Small antenna / pipe accents.
      const p = lotPoint(lot, top.w * 0.12, top.d * 0.08)
      b.box({
        x: p.x, y: roofY + h + 1.2, z: p.z,
        w: 0.18, h: 2.4, d: 0.18, ry: lot.ry,
        color: '#888', rect, faces: SIDES_TOP,
      })
      break
    }
    case 'crown': {
      const steps = 3
      let cw = top.w
      let cd = top.d
      let cy = roofY
      for (let i = 0; i < steps; i++) {
        const h = (cap.height || 6) / steps
        b.box({
          x: lot.x, y: cy + h / 2, z: lot.z, w: cw, h, d: cd,
          ry: lot.ry, color: i === steps - 1 ? dark : capColor, rect, faces: SIDES_TOP,
        })
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
        b.wedge({
          x: px, y: roofY + (cap.height || 2.4) / 2, z: pz,
          w: tw * 0.94, h: cap.height || 2.4, d: top.d * 0.9,
          ry: lot.ry, color: capColor, rect,
        })
      }
      break
    }
    case 'gable':
      b.wedge({
        x: lot.x, y: roofY + (cap.height || 1.8) / 2, z: lot.z,
        w: top.w, h: cap.height || 1.8, d: top.d,
        ry: lot.ry, color: capColor, rect,
      })
      break
    case 'open-deck':
      b.box({
        x: lot.x, y: roofY + (cap.height || 1) / 2, z: lot.z,
        w: top.w * 0.98, h: cap.height || 1, d: top.d * 0.98,
        ry: lot.ry, color: '#a8a49c', rect, faces: SIDES_TOP,
      })
      break
    default:
      break
  }
}

function addStoop(b, lot, stoop, atlas) {
  const sd = stoop.depth
  const sw = stoop.width
  const steps = stoop.steps
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const h = 1.1 * (1 - t)
    const off = sd * (t + 0.5 / steps)
    const p = lotPoint(lot, 0, lot.d / 2 + off)
    b.box({
      x: p.x, y: h / 2, z: p.z,
      w: sw, h, d: sd / steps, ry: lot.ry,
      color: '#9a958c', rect: atlas.uv('white'), faces: SIDES_TOP,
    })
  }
}

function addStorefront(b, set, atlas, lot, ctx) {
  const { fh, ground, rng, shopCount, frameColor } = ctx
  const white = atlas.uv('white')
  const faceZ = lot.d / 2 + 0.05

  // Large glass bays on the street face.
  const bays = Math.max(2, Math.min(4, Math.round(lot.w / 5)))
  const bayW = lot.w / bays
  const glassH = fh * 0.55
  const glassY = glassH * 0.55 + 0.25
  for (let i = 0; i < bays; i++) {
    const lx = (-0.5 + (i + 0.5) / bays) * lot.w
    const p = lotPoint(lot, lx, faceZ - 0.08)
    b.box({
      x: p.x, y: glassY, z: p.z,
      w: bayW * 0.72, h: glassH, d: 0.16,
      ry: lot.ry, color: '#1a2838', rect: white, faces: SIDES,
    })
    // Frame lintel
    const fl = lotPoint(lot, lx, faceZ + 0.02)
    b.box({
      x: fl.x, y: glassY + glassH * 0.5 + 0.08, z: fl.z,
      w: bayW * 0.78, h: 0.14, d: 0.12,
      ry: lot.ry, color: frameColor, rect: white, faces: SIDES_TOP,
    })
  }

  // Bulkhead under glass
  b.box({
    x: lot.x, y: 0.28, z: lotPoint(lot, 0, faceZ).z,
    w: lot.w * 0.96, h: 0.55, d: 0.2,
    ry: lot.ry, color: '#5a5550', rect: white, faces: SIDES_TOP,
  })

  if (rng.chance(ground.signChance ?? 0.8)) {
    const shopIdx = rng.int(0, shopCount - 1)
    const face = lotPoint(lot, 0, faceZ + 0.02)
    set.emissive.billboard({
      x: face.x, y: fh * 0.9, z: face.z, w: lot.w * 0.7, h: 1.15,
      ry: lot.ry, color: '#ffffff', rect: atlas.uv('shop-' + shopIdx), emissive: true,
    })
  }
  if (rng.chance(ground.awningChance ?? 0.5)) {
    const aw = lot.w * 0.78
    const p = lotPoint(lot, 0, lot.d / 2 + 0.56)
    b.box({
      x: p.x, y: fh * 0.68, z: p.z,
      w: aw, h: 0.14, d: 1.15, ry: lot.ry,
      color: rng.pick(['#8a3a3a', '#2e5a6e', '#3a5a3a', '#6e5a2e', '#c45a2e']),
      rect: white, faces: SIDES_ALL,
    })
  }
}

function addRollDoors(b, lot, ground, atlas, rng) {
  const count = ground.count || 3
  const white = atlas.uv('white')
  for (let i = 0; i < count; i++) {
    const lx = (-0.5 + (i + 0.5) / count) * lot.w * 0.85
    const p = lotPoint(lot, lx, lot.d / 2 + 0.05)
    b.box({
      x: p.x, y: 2.2, z: p.z,
      w: Math.min(4.5, lot.w / count * 0.7), h: 4.2, d: 0.18,
      ry: lot.ry, color: '#3a4048', rect: white, faces: SIDES,
    })
  }
}

function addLitWindows(set, atlas, lot, ctx) {
  const { floors, fh, bays, totalH, litChance, rng, shells } = ctx
  const litRect = atlas.uv('litwindow')
  const maxLit = Math.min(14, Math.round(floors * bays * litChance * 0.55))
  const main = shells[0]
  for (let i = 0; i < maxLit; i++) {
    const f = rng.int(0, Math.max(0, floors - 1))
    const bay = rng.int(0, Math.max(0, bays - 1))
    const side = rng.chance(0.5) ? 1 : -1
    const along = (-0.5 + (bay + 0.5) / bays) * (main?.w || lot.w)
    const wy = f * fh + fh * 0.55
    if (wy > totalH - 0.5) continue
    // Prefer upper floors for night glow (base often retail).
    if (wy < (shells[0]?.role === 'base' ? shells[0].h : 0) + 0.5 && rng.chance(0.5)) continue
    const outward = (main?.d || lot.d) / 2 + 0.09
    const p = lotPoint(lot, along, side * outward)
    set.emissive.billboard({
      x: p.x, y: wy, z: p.z,
      w: 1.05, h: 0.9,
      ry: lot.ry + (side < 0 ? Math.PI : 0),
      color: rng.pick(['#ffe9b8', '#ffd98a', '#d8e4ff', '#ffcf9a', '#fff0c8']),
      rect: litRect, emissive: true,
    })
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
