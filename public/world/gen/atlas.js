/**
 * RAFFI WORLD — the one and only texture.
 *
 * Everything visible in Port Vantage samples a single procedurally painted
 * 1152x1152 canvas: facades (with their window grids already baked in), road
 * surfaces, sidewalks, signage text, chainlink, blob shadows. No files are
 * downloaded, and one atlas means one material, which is what keeps the draw
 * call budget reachable.
 *
 * Layout: a 9x9 grid of 128px cells. UVs are always clamped inside a cell —
 * nothing tiles across cell borders, so there is no bleeding. Where a facade
 * needs fewer floors than the painted grid, the geometry samples a sub-rect of
 * the cell instead of repeating.
 */

import * as THREE from 'three'
import { makeRng } from '../engine/state.js'

export const ATLAS_SIZE = 1152
export const CELL = 128
export const COLS = ATLAS_SIZE / CELL

/** Painted window grid inside every facade cell. */
export const FACADE_BAYS = 6
export const FACADE_FLOORS = 8

const uvRects = new Map()
let cursor = 0

function nextCell(name) {
  const i = cursor++
  if (i >= COLS * COLS) throw new Error('atlas full — raise ATLAS_SIZE or shrink CELL')
  const cx = (i % COLS) * CELL
  const cy = Math.floor(i / COLS) * CELL
  // Slightly larger inset so bilinear filtering (soft PS2 look) does not bleed
  // neighbouring facade cells into each other.
  const e = 1.5 / ATLAS_SIZE
  uvRects.set(name, {
    u0: cx / ATLAS_SIZE + e,
    v0: 1 - (cy + CELL) / ATLAS_SIZE + e,
    u1: (cx + CELL) / ATLAS_SIZE - e,
    v1: 1 - cy / ATLAS_SIZE - e,
    px: cx,
    py: cy,
  })
  return { cx, cy }
}

/** UV rect for a named tile. Falls back to flat white so a typo never crashes. */
export function uv(name) {
  return uvRects.get(name) || uvRects.get('white')
}

/**
 * Maps a local 0..1 face coordinate into a tile's cell, optionally sampling
 * only part of the cell (used to get the right number of window rows without
 * tiling). `su`/`sv` are fractions of the cell to cover.
 */
export function uvAt(rect, u, v, su = 1, sv = 1) {
  return [rect.u0 + (rect.u1 - rect.u0) * u * su, rect.v0 + (rect.v1 - rect.v0) * v * sv]
}

// --------------------------------------------------------------- paint ---

function noise(ctx, cx, cy, amount, rng) {
  if (amount <= 0) return
  const img = ctx.getImageData(cx, cy, CELL, CELL)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.next() - 0.5) * 255 * amount
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  ctx.putImageData(img, cx, cy)
}

function paintPattern(ctx, cx, cy, spec, rng) {
  ctx.save()
  ctx.fillStyle = spec.base
  ctx.fillRect(cx, cy, CELL, CELL)
  ctx.strokeStyle = spec.accent
  ctx.fillStyle = spec.accent

  switch (spec.pattern) {
    case 'brick': {
      const bh = 6
      const bw = 14
      ctx.lineWidth = 1
      for (let y = 0; y < CELL; y += bh) {
        const off = (y / bh) % 2 ? bw / 2 : 0
        ctx.beginPath()
        ctx.moveTo(cx, cy + y + 0.5)
        ctx.lineTo(cx + CELL, cy + y + 0.5)
        ctx.stroke()
        for (let x = -bw; x < CELL + bw; x += bw) {
          ctx.beginPath()
          ctx.moveTo(cx + x + off + 0.5, cy + y)
          ctx.lineTo(cx + x + off + 0.5, cy + y + bh)
          ctx.stroke()
        }
      }
      break
    }
    case 'ashlar': {
      ctx.lineWidth = 1
      for (let y = 0; y < CELL; y += 10) {
        ctx.fillRect(cx, cy + y, CELL, 1)
      }
      for (let x = 0; x < CELL; x += 22) {
        ctx.fillRect(cx + x, cy, 1, CELL)
      }
      break
    }
    case 'panel': {
      ctx.lineWidth = 1
      for (let y = 0; y < CELL; y += 16) ctx.fillRect(cx, cy + y, CELL, 1)
      for (let x = 0; x < CELL; x += 16) ctx.fillRect(cx + x, cy, 1, CELL)
      break
    }
    case 'curtain': {
      // Strong vertical mullions — the defining feature of the Downtown towers.
      for (let x = 0; x < CELL; x += 8) ctx.fillRect(cx + x, cy, 2, CELL)
      ctx.globalAlpha = 0.5
      for (let y = 0; y < CELL; y += 16) ctx.fillRect(cx, cy + y, CELL, 1)
      ctx.globalAlpha = 1
      break
    }
    case 'corrugate': {
      for (let x = 0; x < CELL; x += 6) {
        ctx.globalAlpha = 0.55
        ctx.fillRect(cx + x, cy, 2, CELL)
        ctx.globalAlpha = 1
      }
      break
    }
    default:
      break
  }
  ctx.restore()
  noise(ctx, cx, cy, spec.noise || 0.05, rng)
}

/** Paints the window grid a facade cell carries. */
function paintWindows(ctx, cx, cy, style, rng) {
  const bw = CELL / FACADE_BAYS
  const bh = CELL / FACADE_FLOORS

  for (let f = 0; f < FACADE_FLOORS; f++) {
    for (let b = 0; b < FACADE_BAYS; b++) {
      const x = cx + b * bw
      const y = cy + f * bh
      let w = bw * 0.5
      let h = bh * 0.56
      let ox = (bw - w) / 2
      let oy = (bh - h) / 2

      if (style === 'curtain') { w = bw * 0.74; h = bh * 0.66; ox = (bw - w) / 2; oy = (bh - h) / 2 }
      if (style === 'clerestory') { if (f > 1) continue; h = bh * 0.4; oy = bh * 0.2 }
      if (style === 'shop') { w = bw * 0.66; h = bh * 0.5; ox = (bw - w) / 2; oy = (bh - h) / 2 }
      if (style === 'deck') {
        // Open parking deck: a continuous dark band, not punched openings.
        ctx.fillStyle = 'rgba(10,12,16,0.72)'
        ctx.fillRect(cx, y + bh * 0.28, CELL, bh * 0.46)
        continue
      }

      // Glass is a dark, slightly varying pane. Lit windows are added later as
      // separate emissive quads so they can respond to the grade.
      const shade = 18 + Math.floor(rng.next() * 26)
      ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 10})`
      ctx.fillRect(x + ox, y + oy, w, h)

      // Reveal / sill.
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.fillRect(x + ox, y + oy + h, w, 1)
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.fillRect(x + ox, y + oy - 1, w, 1)
    }
  }
}

function paintText(ctx, cx, cy, text, opts = {}) {
  const bg = opts.bg || '#12141c'
  const fg = opts.fg || '#ffe347'
  ctx.save()
  ctx.fillStyle = bg
  ctx.fillRect(cx, cy, CELL, CELL)
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (test.length > 11 && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)

  const size = Math.max(9, Math.min(24, Math.floor(96 / Math.max(lines.length, 1))))
  ctx.font = `bold ${size}px "Lucida Console", monospace`
  const total = lines.length * (size + 3)
  let y = cy + CELL / 2 - total / 2 + size / 2
  for (const l of lines) {
    ctx.fillText(l, cx + CELL / 2, y, CELL - 8)
    y += size + 3
  }
  ctx.restore()
}

// ---------------------------------------------------------------- build ---

/**
 * Paints the atlas and returns `{ texture, uv, canvas }`.
 * @param blocks   parsed blocks.json (facade definitions)
 * @param dialogue parsed dialogue.json (signage strings)
 */
export function buildAtlas(blocks, dialogue, seed = 'atlas') {
  const rng = makeRng(seed)
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  uvRects.clear()
  cursor = 0

  // --- flat white first: the fallback and the fill for solid-colour geometry.
  {
    const { cx, cy } = nextCell('white')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cx, cy, CELL, CELL)
  }

  // --- facades, each with its window grid painted in ------------------------
  const windowStyleFor = (name) => {
    if (name.startsWith('glass')) return 'curtain'
    if (name.startsWith('corrugated')) return 'clerestory'
    if (name.startsWith('concrete')) return 'deck'
    if (name.startsWith('stucco') || name.startsWith('panel')) return 'shop'
    return 'grid'
  }

  for (const [name, spec] of Object.entries(blocks.facades)) {
    const { cx, cy } = nextCell('wall/' + name)
    paintPattern(ctx, cx, cy, spec, rng)
    paintWindows(ctx, cx, cy, windowStyleFor(name), rng)
  }

  // --- blank facade variants (no windows) for parapets, sides, roofs --------
  for (const [name, spec] of Object.entries(blocks.facades)) {
    const { cx, cy } = nextCell('flat/' + name)
    paintPattern(ctx, cx, cy, spec, rng)
  }

  // --- ground surfaces ------------------------------------------------------
  {
    const { cx, cy } = nextCell('road')
    ctx.fillStyle = '#405563'
    ctx.fillRect(cx, cy, CELL, CELL)
    for (let i = 0; i < 260; i++) {
      const g = 55 + Math.floor(rng.next() * 30)
      ctx.fillStyle = `rgba(${g},${g + 7},${g + 12},0.45)`
      ctx.fillRect(cx + rng.next() * CELL, cy + rng.next() * CELL, 2, 2)
    }
    // Faint patch seams so a big road plane is not a dead flat colour.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + rng.next() * CELL, cy)
      ctx.lineTo(cx + rng.next() * CELL, cy + CELL)
      ctx.stroke()
    }
  }

  {
    const { cx, cy } = nextCell('sidewalk')
    ctx.fillStyle = '#c7b49f'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'
    ctx.lineWidth = 1
    for (let i = 0; i <= CELL; i += 32) {
      ctx.beginPath(); ctx.moveTo(cx + i + 0.5, cy); ctx.lineTo(cx + i + 0.5, cy + CELL); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy + i + 0.5); ctx.lineTo(cx + CELL, cy + i + 0.5); ctx.stroke()
    }
    noise(ctx, cx, cy, 0.07, rng)
  }

  {
    const { cx, cy } = nextCell('cobble')
    ctx.fillStyle = '#afa18e'
    ctx.fillRect(cx, cy, CELL, CELL)
    for (let y = 0; y < CELL; y += 8) {
      for (let x = 0; x < CELL; x += 10) {
        const off = (y / 8) % 2 ? 5 : 0
        const g = 112 + Math.floor(rng.next() * 36)
        ctx.fillStyle = `rgb(${g},${g - 4},${g - 12})`
        ctx.fillRect(cx + x + off, cy + y, 8, 6)
      }
    }
  }

  {
    const { cx, cy } = nextCell('dirt')
    ctx.fillStyle = '#a47762'
    ctx.fillRect(cx, cy, CELL, CELL)
    noise(ctx, cx, cy, 0.16, rng)
  }

  {
    const { cx, cy } = nextCell('grass')
    ctx.fillStyle = '#4f8767'
    ctx.fillRect(cx, cy, CELL, CELL)
    noise(ctx, cx, cy, 0.14, rng)
  }

  {
    const { cx, cy } = nextCell('lane')
    ctx.fillStyle = '#405563'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = '#d8d2be'
    // One dash centred in the cell; road segments map a strip of this.
    ctx.fillRect(cx + CELL * 0.44, cy + CELL * 0.15, CELL * 0.12, CELL * 0.7)
  }

  {
    const { cx, cy } = nextCell('crosswalk')
    ctx.fillStyle = '#405563'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = '#e0dbc8'
    for (let x = 6; x < CELL; x += 22) ctx.fillRect(cx + x, cy + 6, 12, CELL - 12)
  }

  {
    const { cx, cy } = nextCell('chainlink')
    ctx.clearRect(cx, cy, CELL, CELL)
    ctx.strokeStyle = 'rgba(190,196,200,0.85)'
    ctx.lineWidth = 1.5
    for (let i = -CELL; i < CELL; i += 9) {
      ctx.beginPath(); ctx.moveTo(cx + i, cy); ctx.lineTo(cx + i + CELL, cy + CELL); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + i + CELL, cy); ctx.lineTo(cx + i, cy + CELL); ctx.stroke()
    }
  }

  {
    // Blob shadow — the only shadow in the entire game.
    const { cx, cy } = nextCell('blob')
    const g = ctx.createRadialGradient(cx + CELL / 2, cy + CELL / 2, 2, cx + CELL / 2, cy + CELL / 2, CELL / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.85)')
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.clearRect(cx, cy, CELL, CELL)
    ctx.fillStyle = g
    ctx.fillRect(cx, cy, CELL, CELL)
  }

  {
    const { cx, cy } = nextCell('water')
    ctx.fillStyle = '#2b3a52'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (let y = 0; y < CELL; y += 7) ctx.fillRect(cx, cy + y, CELL, 2)
  }

  {
    const { cx, cy } = nextCell('glasspane')
    ctx.fillStyle = 'rgba(140,180,210,0.5)'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(cx, cy, CELL, 3)
  }

  {
    // A single lit window pane, used for the emissive night pass.
    const { cx, cy } = nextCell('litwindow')
    ctx.fillStyle = '#ffe9b8'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fillRect(cx + CELL / 2 - 2, cy, 4, CELL)
    ctx.fillRect(cx, cy + CELL / 2 - 2, CELL, 4)
  }

  // --- signage -------------------------------------------------------------
  const signage = dialogue.signage || {}
  for (const [key, text] of Object.entries(signage)) {
    if (key === 'billboards' || key.startsWith('$')) continue
    const { cx, cy } = nextCell(key)
    paintText(ctx, cx, cy, text, { bg: '#141824', fg: '#ffe347' })
  }
  ;(signage.billboards || []).forEach((text, i) => {
    const { cx, cy } = nextCell('billboard-' + i)
    paintText(ctx, cx, cy, text, { bg: '#1a1420', fg: '#ff6bb0' })
  })

  // Generic shopfront signs so lowrise retail has something on it.
  const SHOP_WORDS = ['DELI', 'LAUNDRY', '24HR', 'COFFEE', 'PIZZA', 'HARDWARE', 'NAILS', 'LIQUOR', 'PHARMACY', 'BODEGA']
  SHOP_WORDS.forEach((w, i) => {
    const { cx, cy } = nextCell('shop-' + i)
    paintText(ctx, cx, cy, w, { bg: rng.pick(['#1c2430', '#2a1c20', '#20242c']), fg: rng.pick(['#ffe347', '#39e6ff', '#ff3d8a', '#f0ece0']) })
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // Linear mag = soft early-2000s city texture, not Minecraft nearest pixels.
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 2
  texture.needsUpdate = true

  return { texture, canvas, uv, uvAt, shopCount: SHOP_WORDS.length, billboardCount: (signage.billboards || []).length }
}
