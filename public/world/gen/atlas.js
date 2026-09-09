/**
 * RAFFI WORLD — shared procedural surface atlas.
 *
 * Everything visible in Port Vantage samples a single procedurally painted
 * 2560x2560 canvas: facades (with their window grids already baked in), road
 * surfaces, sidewalks, signage text, chainlink, blob shadows. No files are
 * downloaded; aligned colour, roughness and relief atlases share one physical
 * material, which keeps the draw
 * call budget reachable.
 *
 * Layout: a 10x10 grid of 256px cells. UVs are always clamped inside a cell —
 * nothing repeats across cell borders. Inset UVs protect normal-size sampling. Where a facade
 * needs fewer floors than the painted grid, the geometry samples a sub-rect of
 * the cell instead of repeating.
 */

import * as THREE from 'three'
import { makeRng } from '../engine/state.js'

export const ATLAS_SIZE = 2560
export const CELL = 256
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
  // An inset keeps bilinear filtering from bleeding
  // neighbouring facade cells into each other.
  const e = 4 / ATLAS_SIZE
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
  ctx.beginPath()
  ctx.rect(cx, cy, CELL, CELL)
  ctx.clip()
  ctx.fillStyle = spec.base
  ctx.fillRect(cx, cy, CELL, CELL)
  ctx.strokeStyle = spec.accent
  ctx.fillStyle = spec.accent

  switch (spec.pattern) {
    case 'brick': {
      const bh = 10
      const bw = 25
      ctx.lineWidth = 1.3
      // Individual fired brick colours, mortar joints and a fine upper bevel.
      for (let y = 0; y < CELL; y += bh) {
        const offset = (y / bh) % 2 ? bw / 2 : 0
        for (let x = -bw; x < CELL; x += bw) {
          ctx.fillStyle = rng.chance(0.45) ? 'rgba(27,16,12,0.08)' : 'rgba(238,214,184,0.07)'
          ctx.fillRect(cx + x + offset + 1, cy + y + 1, bw - 2, bh - 2)
          ctx.fillStyle = 'rgba(239,215,185,0.12)'
          ctx.fillRect(cx + x + offset + 1, cy + y + 1, bw - 2, 0.7)
        }
      }
      ctx.fillStyle = spec.accent
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
    // Rain runoff and age stay restrained so physical illumination reads clearly.
  if (spec.pattern !== 'curtain') {
    for (let i = 0; i < 7; i++) {
      const x = cx + rng.next() * CELL
      const y = cy + rng.next() * CELL
      const streak = ctx.createLinearGradient(x, y, x, y + 55)
      streak.addColorStop(0, 'rgba(25,29,26,0.045)')
      streak.addColorStop(1, 'rgba(25,29,26,0)')
      ctx.fillStyle = streak
      ctx.fillRect(x, y, 1 + rng.next() * 4, 55)
    }
  }
  ctx.restore()
  noise(ctx, cx, cy, (spec.noise || 0.05) * 0.55, rng)
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

      // A few inhabited windows carry warm blinds; the separate emissive pass
      // adds the brighter windows without adding geometry to every facade.
      const shade = 18 + Math.floor(rng.next() * 26)
      const warm = style === 'grid' && (f * 7 + b * 3) % 5 === 0
      ctx.fillStyle = warm ? '#bd9260' : `rgb(${shade},${shade + 4},${shade + 10})`
      ctx.fillRect(x + ox, y + oy, w, h)

      ctx.fillStyle = warm ? '#775940' : 'rgba(170,184,199,0.16)'
      ctx.fillRect(x + ox, y + oy + h * 0.4, w, 1)
      ctx.fillRect(x + ox + w * 0.48, y + oy, 1, h)

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

  const size = Math.max(18, Math.min(43, Math.floor(192 / Math.max(lines.length, 1))))
  ctx.font = `bold ${size}px "Lucida Console", monospace`
  const total = lines.length * (size + 3)
  let y = cy + CELL / 2 - total / 2 + size / 2
  for (const l of lines) {
    ctx.fillText(l, cx + CELL / 2, y, CELL - 8)
    y += size + 3
  }
  ctx.restore()
}

function paintRecordWindow(ctx, cx, cy) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(CELL / 128, CELL / 128)
  ctx.fillStyle = '#192e3b'
  ctx.fillRect(0, 0, CELL, CELL)
  const sleeves = ['#d5986e', '#849db4', '#c8b988', '#a95f63', '#9baa88', '#ece0bc']
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 6 + col * 30
      const y = 16 + row * 34
      ctx.fillStyle = sleeves[(col + row * 2) % sleeves.length]
      ctx.fillRect(x, y, 25, 27)
      ctx.fillStyle = '#22303b'
      ctx.beginPath()
      ctx.arc(x + 12.5, y + 12, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = sleeves[(col + row + 3) % sleeves.length]
      ctx.beginPath()
      ctx.arc(x + 12.5, y + 12, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#ab815a'
    ctx.fillRect(0, 44 + row * 34, CELL, 3)
  }
  ctx.fillStyle = '#eac681'
  ctx.fillRect(0, 0, CELL, 4)
  ctx.fillStyle = 'rgba(197,218,219,0.12)'
  ctx.beginPath()
  ctx.moveTo(0, 7)
  ctx.lineTo(30, 7)
  ctx.lineTo(100, 128)
  ctx.lineTo(70, 128)
  ctx.fill()
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
    ctx.fillStyle = '#53585b'
    ctx.fillRect(cx, cy, CELL, CELL)
    for (let i = 0; i < 2800; i++) {
      const g = 60 + Math.floor(rng.next() * 52)
      ctx.fillStyle = `rgba(${g},${g + 2},${g + 4},0.4)`
      ctx.fillRect(cx + rng.next() * CELL, cy + rng.next() * CELL, 2, 2)
    }
    // Faint patch seams so a big road plane is not a dead flat colour.
    ctx.strokeStyle = 'rgba(26,31,32,0.13)'
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + rng.next() * CELL, cy)
      ctx.lineTo(cx + rng.next() * CELL, cy + CELL)
      ctx.stroke()
    }
  }

  {
    const { cx, cy } = nextCell('sidewalk')
    ctx.fillStyle = '#b9b5a9'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.strokeStyle = 'rgba(53,54,47,0.21)'
    ctx.lineWidth = 1.4
    for (let i = 0; i <= CELL; i += 64) {
      ctx.beginPath(); ctx.moveTo(cx + i + 0.5, cy); ctx.lineTo(cx + i + 0.5, cy + CELL); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy + i + 0.5); ctx.lineTo(cx + CELL, cy + i + 0.5); ctx.stroke()
    }
    noise(ctx, cx, cy, 0.035, rng)
  }

  {
    const { cx, cy } = nextCell('cobble')
    ctx.fillStyle = '#7f817d'
    ctx.fillRect(cx, cy, CELL, CELL)
    for (let y = 0; y < CELL; y += 4) {
      for (let x = 0; x < CELL; x += 5) {
        const off = (y / 4) % 2 ? 2.5 : 0
        const g = 137 + Math.floor(rng.next() * 18)
        ctx.fillStyle = `rgb(${g},${g - 1},${g - 6})`
        ctx.fillRect(cx + x + off, cy + y, 4.5, 3.5)
      }
    }
  }

  {
    const { cx, cy } = nextCell('dirt')
    ctx.fillStyle = '#8b8273'
    ctx.fillRect(cx, cy, CELL, CELL)
    noise(ctx, cx, cy, 0.16, rng)
  }

  {
    const { cx, cy } = nextCell('grass')
    ctx.fillStyle = '#536d47'
    ctx.fillRect(cx, cy, CELL, CELL)
    noise(ctx, cx, cy, 0.14, rng)
  }

  {
    const { cx, cy } = nextCell('lane')
    ctx.fillStyle = '#53585b'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = '#d8d2be'
    // One dash centred in the cell; road segments map a strip of this.
    ctx.fillRect(cx + CELL * 0.44, cy + CELL * 0.15, CELL * 0.12, CELL * 0.7)
  }

  {
    const { cx, cy } = nextCell('crosswalk')
    ctx.fillStyle = '#53585b'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = '#e0dbc8'
    for (let x = 12; x < CELL; x += 44) ctx.fillRect(cx + x, cy + 12, 24, CELL - 24)
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
    // Soft contact decal supplements the sun shadow at a prop foot.
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
    const palette = {
      'sign-records': { bg: '#29495c', fg: '#f3d8a2' },
      'sign-club': { bg: '#392842', fg: '#eda5b6' },
      'sign-deli': { bg: '#456052', fg: '#f0d6a6' },
      'sign-garage': { bg: '#31435c', fg: '#edcf87' },
      'sign-subway': { bg: '#202c39', fg: '#e7d9b2' },
    }
    paintText(ctx, cx, cy, text, palette[key] || { bg: '#263142', fg: '#e8cf93' })
  }
  ;(signage.billboards || []).forEach((text, i) => {
    const { cx, cy } = nextCell('billboard-' + i)
    paintText(ctx, cx, cy, text, { bg: '#1a1420', fg: '#ff6bb0' })
  })

  const SHOP_WORDS = ['SUNRISE DELI', 'SPIN CYCLE', 'NIGHT OWL', 'CORNER COFFEE', 'LAST SLICE', 'HARDWARE', 'NAILS', 'BOTTLE SHOP', 'PHARMACY', 'RECORDS']
  SHOP_WORDS.forEach((w, i) => {
    const { cx, cy } = nextCell('shop-' + i)
    paintText(ctx, cx, cy, w, { bg: rng.pick(['#314c56', '#643e3b', '#3e5145']), fg: rng.pick(['#edcf91', '#bccfd4', '#dba4a1', '#ece0c2']) })
  })

  const recordWindow = nextCell('record-window')
  paintRecordWindow(ctx, recordWindow.cx, recordWindow.cy)

  // Dedicated materials keep rooftops and glass from borrowing brick/window tiles.
  // A separate stream leaves all existing generated texture choices stable.
  const surfaceRng = makeRng('surface-materials-v2')
  {
    const { cx, cy } = nextCell('roof-tar')
    ctx.fillStyle = '#525a60'
    ctx.fillRect(cx, cy, CELL, CELL)
    for (let y = 0; y < CELL; y += 32) {
      ctx.fillStyle = y % 64 ? '#596166' : '#4e565d'
      ctx.fillRect(cx, cy + y, CELL, 30)
      ctx.fillStyle = '#768087'
      ctx.fillRect(cx, cy + y, CELL, 1)
    }
    ctx.fillStyle = '#414950'
    ctx.fillRect(cx + 24, cy + 16, 30, 24)
    ctx.fillRect(cx + 80, cy + 75, 35, 18)
    noise(ctx, cx, cy, 0.07, surfaceRng)
  }
  {
    const { cx, cy } = nextCell('window-reflection')
    const glass = ctx.createLinearGradient(cx, cy, cx + CELL * 0.45, cy + CELL)
    glass.addColorStop(0, '#82999f')
    glass.addColorStop(0.38, '#667f88')
    glass.addColorStop(0.48, '#475f66')
    glass.addColorStop(1, '#243b42')
    ctx.fillStyle = glass
    ctx.fillRect(cx, cy, CELL, CELL)
    // Reflected skyline silhouettes are confined to the lower glass; geometry
    // supplies the mullions so facade windows never acquire a second fake grid.
    for (let i = 0; i < 13; i++) {
      const h = CELL * surfaceRng.range(0.1, 0.38)
      ctx.fillStyle = `rgba(30,48,55,${surfaceRng.range(0.08, 0.2)})`
      ctx.fillRect(cx + i * CELL / 13, cy + CELL - h, CELL / 13, h)
    }
    ctx.fillStyle = 'rgba(218,232,229,0.075)'
    ctx.beginPath()
    ctx.moveTo(cx + 12, cy)
    ctx.lineTo(cx + 34, cy)
    ctx.lineTo(cx + CELL - 32, cy + CELL)
    ctx.lineTo(cx + CELL - 54, cy + CELL)
    ctx.fill()
  }
  {
    const { cx, cy } = nextCell('awning-stripe')
    ctx.fillStyle = '#35565d'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = '#c5b69a'
    for (let x = 0; x < CELL; x += 32) ctx.fillRect(cx + x, cy, 13, CELL)
    ctx.fillStyle = 'rgba(20,32,35,0.22)'
    ctx.fillRect(cx, cy + CELL - 18, CELL, 18)
  }
  {
    const { cx, cy } = nextCell('warm-pool')
    const glow = ctx.createRadialGradient(cx + CELL / 2, cy + CELL / 2, 0, cx + CELL / 2, cy + CELL / 2, CELL / 2)
    glow.addColorStop(0, 'rgba(246,197,111,0.3)')
    glow.addColorStop(0.35, 'rgba(231,169,87,0.14)')
    glow.addColorStop(1, 'rgba(231,169,87,0)')
    ctx.clearRect(cx, cy, CELL, CELL)
    ctx.fillStyle = glow
    ctx.fillRect(cx, cy, CELL, CELL)
  }

  for (const [name, color] of [['car-paint', '#ffffff'], ['headlamp', '#fff6dc'], ['taillamp', '#ffddd8'], ['beacon', '#def9ff']]) {
    const { cx, cy } = nextCell(name)
    ctx.fillStyle = color
    ctx.fillRect(cx, cy, CELL, CELL)
  }
  {
    const { cx, cy } = nextCell('car-glass')
    const glass = ctx.createLinearGradient(cx, cy, cx, cy + CELL)
    glass.addColorStop(0, '#30434a')
    glass.addColorStop(0.42, '#24353c')
    glass.addColorStop(0.54, '#15232b')
    glass.addColorStop(1, '#0b151b')
    ctx.fillStyle = glass
    ctx.fillRect(cx, cy, CELL, CELL)
  }
  for (const [name, color] of [['car-rubber', '#282a29'], ['car-chrome', '#d4d8d6']]) {
    const { cx, cy } = nextCell(name)
    ctx.fillStyle = color
    ctx.fillRect(cx, cy, CELL, CELL)
    if (name === 'car-rubber') noise(ctx, cx, cy, 0.016, makeRng('car-rubber-grain'))
  }
  {
    const { cx, cy } = nextCell('fleet-markings')
    // Original service markings, quarter-cell UVs; no imported brand artwork.
    const labels = ['T', 'TAXI', '27', 'LOCAL']
    for (let i = 0; i < 4; i++) {
      const x = cx + (i % 2) * 128, y = cy + Math.floor(i / 2) * 128
      ctx.fillStyle = i < 2 ? '#eeb528' : '#d8d5c6'; ctx.fillRect(x, y, 128, 128)
      ctx.fillStyle = i < 2 ? '#172021' : '#234439'
      if (i === 0) { ctx.beginPath(); ctx.arc(x + 64, y + 64, 51, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#eeb528' }
      ctx.font = `bold ${i === 0 ? 82 : i === 2 ? 78 : 31}px Arial, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(labels[i], x + 64, y + 65)
      if (i === 3) { ctx.font = 'bold 15px Arial, sans-serif'; ctx.fillText('BROOKLYN', x + 64, y + 96) }
    }
    ctx.textBaseline = 'alphabetic'
  }
  {
    const { cx, cy } = nextCell('cafe-menu')
    ctx.fillStyle = '#2f4039'; ctx.fillRect(cx, cy, CELL, CELL)
    ctx.strokeStyle = '#9c8865'; ctx.lineWidth = 12; ctx.strokeRect(cx + 8, cy + 8, CELL - 16, CELL - 16)
    ctx.fillStyle = '#dbd6bb'; ctx.textAlign = 'center'; ctx.font = 'bold 30px Arial, sans-serif'
    ctx.fillText('COFFEE', cx + 128, cy + 57)
    ctx.font = '20px Arial, sans-serif'
    for (const [i, line] of ['ESPRESSO  $3', 'FILTER  $3', 'ICED  $4', 'BAKED DAILY'].entries()) ctx.fillText(line, cx + 128, cy + 102 + i * 35)
  }
  {
    const { cx, cy } = nextCell('shop-glass')
    ctx.clearRect(cx, cy, CELL, CELL)
    const glass = ctx.createLinearGradient(cx, cy, cx, cy + CELL)
    glass.addColorStop(0, 'rgba(166,193,194,0.14)')
    glass.addColorStop(0.48, 'rgba(123,154,163,0.075)')
    glass.addColorStop(1, 'rgba(74,105,117,0.04)')
    ctx.fillStyle = glass
    ctx.fillRect(cx, cy, CELL, CELL)
  }
  {
    const { cx, cy } = nextCell('album-sleeve')
    // Four original sleeve designs share one cell; no repeated shop-window art.
    for (let cover=0;cover<4;cover++) {
      const x=cx+(cover%2)*128, y=cy+Math.floor(cover/2)*128
      ctx.save();ctx.beginPath();ctx.rect(x,y,128,128);ctx.clip()
      ctx.fillStyle=['#dbd0b2','#7f3f38','#334b57','#c0a372'][cover]
      ctx.fillRect(x,y,128,128)
      if (cover===0) {
        ctx.fillStyle='#526b68';ctx.fillRect(x+9,y+11,110,87)
        ctx.fillStyle='#d9c697';ctx.beginPath();ctx.arc(x+64,y+56,33,0,Math.PI*2);ctx.fill()
        ctx.fillStyle='#263e3d';ctx.beginPath();ctx.arc(x+64,y+56,21,0,Math.PI*2);ctx.fill()
      } else if (cover===1) {
        ctx.fillStyle='#dabd90';ctx.fillRect(x+14,y+14,24,100);ctx.fillRect(x+86,y+14,28,100)
        ctx.fillStyle='#382f31';ctx.fillRect(x+42,y+35,37,71)
      } else if (cover===2) {
        ctx.fillStyle='#a8bab1';ctx.fillRect(x+10,y+10,108,73)
        for(let tower=0;tower<7;tower++) {ctx.fillStyle=tower%2?'#42574f':'#617069';ctx.fillRect(x+12+tower*15,y+29+(tower%3)*11,14,54-(tower%3)*11)}
      } else {
        ctx.strokeStyle='#334e47';ctx.lineWidth=7
        for(let line=0;line<5;line++) {ctx.beginPath();ctx.moveTo(x+12,y+17+line*16);ctx.lineTo(x+114,y+36+line*16);ctx.stroke()}
      }
      ctx.fillStyle=cover===1||cover===2?'#e1d0aa':'#344a43'
      ctx.font='bold 10px Arial, sans-serif';ctx.textAlign='left'
      ctx.fillText(['SIDE A','AFTER HOURS','CITY TAPES','WARM ROOM'][cover],x+14,y+112)
      ctx.restore()
    }
  }

  {
    const { cx, cy } = nextCell('music-flyer')
    ctx.fillStyle = '#dfd2ac'
    ctx.fillRect(cx, cy, CELL, CELL)
    ctx.fillStyle = '#254d43'
    ctx.fillRect(cx + 12, cy + 12, CELL - 24, CELL - 24)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e2d5b0'
    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillText('LISTENING ROOM', cx + 128, cy + 43)
    ctx.fillStyle = '#d6a261'
    ctx.beginPath(); ctx.arc(cx + 128, cy + 117, 55, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1b312c'
    ctx.beginPath(); ctx.arc(cx + 128, cy + 117, 39, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#d6a261'
    ctx.beginPath(); ctx.arc(cx + 128, cy + 117, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e2d5b0'
    ctx.font = 'bold 20px Arial, sans-serif'
    ctx.fillText('FRIDAY / 8 PM', cx + 128, cy + 194)
    ctx.font = '14px Arial, sans-serif'
    ctx.fillText('B-SIDE RECORDS', cx + 128, cy + 223)
    ctx.textAlign = 'left'
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // Trilinear sampling plus anisotropy preserves oblique pavement detail.
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true

  // Physical surface channels are authored by material identity. In particular,
  // painted windows and lettering never become arbitrary embossed normals.
  const roughCanvas = document.createElement('canvas')
  const bumpCanvas = document.createElement('canvas')
  const emissiveCanvas = document.createElement('canvas')
  roughCanvas.width = bumpCanvas.width = emissiveCanvas.width = ATLAS_SIZE
  roughCanvas.height = bumpCanvas.height = emissiveCanvas.height = ATLAS_SIZE
  const rough = roughCanvas.getContext('2d')
  const bump = bumpCanvas.getContext('2d')
  const emissive = emissiveCanvas.getContext('2d')
  emissive.fillStyle = '#000000'
  emissive.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
  rough.fillStyle = '#ffe100'
  rough.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
  bump.fillStyle = '#808080'
  bump.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
  const surfaceChannelsRng = makeRng('physical-surface-channels')
  for (const [name, rect] of uvRects) {
    const { px: cx, py: cy } = rect
    const glass = name.includes('glass') || name === 'window-reflection' || name === 'record-window'
    const smooth = glass || name === 'water'
    const vehicleSurface = { 'car-paint': [72,125], 'car-glass': [31,140], 'car-rubber': [224,0], 'car-chrome': [46,255] }[name]
    const roughness = vehicleSurface?.[0] ?? (smooth ? 67 : name === 'white' ? 158 : name.includes('panel') ? 154 : 226)
    const metalness = vehicleSurface?.[1] ?? (name.includes('corrugated') || name.includes('panel') ? 64 : 0)
    // Three reads roughness from G and metalness from B, so both channels
    // share one GPU texture rather than duplicating a full-size atlas.
    rough.fillStyle = `rgb(255,${roughness},${metalness})`
    rough.fillRect(cx, cy, CELL, CELL)
    if (['headlamp', 'taillamp', 'beacon'].includes(name)) {
      emissive.fillStyle = '#ffffff'
      emissive.fillRect(cx, cy, CELL, CELL)
    }
    const facade = blocks.facades[name.replace(/^(wall|flat)\//, '')]
    if (facade && !glass) {
      paintPattern(bump, cx, cy, { ...facade, base: '#828282', accent: '#727272', noise: 0.014 }, surfaceChannelsRng)
    } else if (['road', 'sidewalk', 'cobble', 'dirt', 'grass', 'roof-tar'].includes(name)) {
      noise(bump, cx, cy, name === 'road' ? 0.045 : 0.035, surfaceChannelsRng)
      if (name === 'sidewalk') {
        bump.fillStyle = '#737373'
        for (let n = 0; n < CELL; n += 64) {
          bump.fillRect(cx + n, cy, 1.4, CELL)
          bump.fillRect(cx, cy + n, CELL, 1.4)
        }
      }
    }
  }
  const channelTexture = (source) => {
    // Surface channels need less resolution than lettering/albedo. Half-size
    // maps hold GPU memory down on phones while preserving material borders.
    const compact = document.createElement('canvas')
    compact.width = compact.height = ATLAS_SIZE / 2
    compact.getContext('2d').drawImage(source, 0, 0, compact.width, compact.height)
    const t = new THREE.CanvasTexture(compact)
    t.colorSpace = THREE.NoColorSpace
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.anisotropy = 8
    return t
  }
  const roughnessTexture = channelTexture(roughCanvas)
  const bumpTexture = channelTexture(bumpCanvas)
  const metalnessTexture = roughnessTexture
  const emissiveTexture = channelTexture(emissiveCanvas)
  texture.userData.surfaceMaps = { roughnessMap: roughnessTexture, bumpMap: bumpTexture, metalnessMap: metalnessTexture, emissiveMap: emissiveTexture }
  return {
    texture, canvas, uv, uvAt,
    roughnessTexture,
    bumpTexture, metalnessTexture, emissiveTexture,
    lightSources: [],
    signLabels: { ...signage, ...Object.fromEntries(SHOP_WORDS.map((text, i) => ['shop-' + i, text])) },
    shopCount: SHOP_WORDS.length,
    billboardCount: (signage.billboards || []).length,
  }
}
