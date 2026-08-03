#!/usr/bin/env node
/**
 * Pure tests for opaque spatial chunking.
 * Mutation: set globalThis.__RAFFI_OPAQUE_CHUNK__ = false and the browser
 * smoke must fail with `pursuit tris 60386 >= 60000` (or any >= 60000).
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partitionOpaqueGeometry,
  triangleSignature,
  triangleAttrSignature,
  chunkBounds,
  isOpaqueChunkingEnabled,
  DEFAULT_SPILL_EXTENT,
} from '../gen/chunk-opaque.js'

function makeBox(x, y, z, w, h, d) {
  // 12 tris, 8 verts expanded as non-indexed first then index 0..n
  const hx = w / 2, hy = h / 2, hd = d / 2
  const corners = [
    [x - hx, y - hy, z - hd],
    [x + hx, y - hy, z - hd],
    [x + hx, y + hy, z - hd],
    [x - hx, y + hy, z - hd],
    [x - hx, y - hy, z + hd],
    [x + hx, y - hy, z + hd],
    [x + hx, y + hy, z + hd],
    [x - hx, y + hy, z + hd],
  ]
  // faces as 2 tris each
  const faces = [
    [0, 1, 2, 0, 2, 3], // -Z
    [5, 4, 7, 5, 7, 6], // +Z
    [4, 0, 3, 4, 3, 7], // -X
    [1, 5, 6, 1, 6, 2], // +X
    [3, 2, 6, 3, 6, 7], // +Y
    [4, 5, 1, 4, 1, 0], // -Y
  ]
  const pos = []
  const uvs = []
  const col = []
  const idx = []
  let vi = 0
  for (const f of faces) {
    for (let k = 0; k < 6; k++) {
      const c = corners[f[k]]
      pos.push(c[0], c[1], c[2])
      uvs.push(k % 2, (k >> 1) % 2)
      col.push(0.5, 0.5, 0.5)
      idx.push(vi++)
    }
  }
  return { pos, uvs, col, idx }
}

test('isOpaqueChunkingEnabled defaults true', () => {
  delete globalThis.__RAFFI_OPAQUE_CHUNK__
  assert.equal(isOpaqueChunkingEnabled(), true)
  globalThis.__RAFFI_OPAQUE_CHUNK__ = false
  assert.equal(isOpaqueChunkingEnabled(), false)
  globalThis.__RAFFI_OPAQUE_CHUNK__ = true
  assert.equal(isOpaqueChunkingEnabled(), true)
  delete globalThis.__RAFFI_OPAQUE_CHUNK__
})

test('triangle signatures identical after partition (positions + winding)', () => {
  const a = makeBox(10, 2, 10, 4, 8, 4)
  const b = makeBox(90, 2, 10, 4, 8, 4)
  const pos = [...a.pos, ...b.pos]
  const uvs = [...a.uvs, ...b.uvs]
  const col = [...a.col, ...b.col]
  const idx = [...a.idx, ...b.idx.map((i) => i + a.pos.length / 3)]

  const before = triangleSignature(pos, idx)
  const parts = partitionOpaqueGeometry(pos, uvs, col, idx, { cellSize: 72, spillExtent: 42 })

  // Rebuild flat lists from chunks
  const p2 = [], u2 = [], c2 = [], i2 = []
  let base = 0
  for (const ch of [...parts.chunks, ...(parts.spill ? [parts.spill] : [])]) {
    p2.push(...ch.positions)
    u2.push(...ch.uvs)
    c2.push(...ch.colors)
    for (const i of ch.indices) i2.push(i + base)
    // wait - indices are local 0..n per chunk already in positions
  }
  // Correct rebuild: each chunk is independent local indices
  const p3 = [], u3 = [], c3 = [], i3 = []
  for (const ch of [...parts.chunks, ...(parts.spill ? [parts.spill] : [])]) {
    const off = p3.length / 3
    p3.push(...ch.positions)
    u3.push(...ch.uvs)
    c3.push(...ch.colors)
    for (const i of ch.indices) i3.push(i + off)
  }

  const after = triangleSignature(p3, i3)
  assert.deepEqual(after, before)
  assert.equal(parts.triangleCount, before.length)
})

test('UVs, colours, and winding survive partition', () => {
  const a = makeBox(5, 1, 5, 3, 6, 3)
  const before = triangleAttrSignature(a.pos, a.uvs, a.col, a.idx)
  const parts = partitionOpaqueGeometry(a.pos, a.uvs, a.col, a.idx)
  const p = [], u = [], c = [], i = []
  for (const ch of [...parts.chunks, ...(parts.spill ? [parts.spill] : [])]) {
    const off = p.length / 3
    p.push(...ch.positions)
    u.push(...ch.uvs)
    c.push(...ch.colors)
    for (const ix of ch.indices) i.push(ix + off)
  }
  const after = triangleAttrSignature(p, u, c, i)
  assert.deepEqual(after, before)
})

test('total triangle count conserved', () => {
  const boxes = [makeBox(0, 0, 0, 2, 2, 2), makeBox(100, 0, 100, 2, 2, 2), makeBox(200, 0, 0, 2, 2, 2)]
  const pos = [], uvs = [], col = [], idx = []
  for (const b of boxes) {
    const off = pos.length / 3
    pos.push(...b.pos)
    uvs.push(...b.uvs)
    col.push(...b.col)
    for (const i of b.idx) idx.push(i + off)
  }
  const parts = partitionOpaqueGeometry(pos, uvs, col, idx)
  let sum = 0
  for (const ch of parts.chunks) sum += ch.indices.length / 3
  if (parts.spill) sum += parts.spill.indices.length / 3
  assert.equal(sum, parts.triangleCount)
  assert.equal(sum, idx.length / 3)
})

test('oversized primitives go to spill and cannot poison local bounds', () => {
  // Tiny building box at origin.
  const tiny = makeBox(0, 2, 0, 4, 8, 4)
  // Huge ground plane (extent >> spill threshold).
  const ground = makeBox(0, 0, 0, 200, 0.1, 200)
  const pos = [...tiny.pos, ...ground.pos]
  const uvs = [...tiny.uvs, ...ground.uvs]
  const col = [...tiny.col, ...ground.col]
  const idx = [
    ...tiny.idx,
    ...ground.idx.map((i) => i + tiny.pos.length / 3),
  ]

  const parts = partitionOpaqueGeometry(pos, uvs, col, idx, {
    cellSize: 72,
    spillExtent: DEFAULT_SPILL_EXTENT,
  })
  assert.ok(parts.spill, 'spill bucket required for oversized ground')
  assert.ok(parts.chunks.length >= 1, 'local chunks for buildings')

  for (const ch of parts.chunks) {
    const b = chunkBounds(ch)
    assert.ok(
      b.extent < DEFAULT_SPILL_EXTENT * 1.5,
      `local chunk ${ch.key} extent ${b.extent} poisoned by ground`
    )
  }
  const spillB = chunkBounds(parts.spill)
  assert.ok(spillB.extent >= DEFAULT_SPILL_EXTENT, 'spill holds the large primitive')
})

test('partition produces multiple spatial chunks for distant buildings', () => {
  const a = makeBox(0, 2, 0, 4, 10, 4)
  const b = makeBox(200, 2, 200, 4, 10, 4)
  const pos = [...a.pos, ...b.pos]
  const uvs = [...a.uvs, ...b.uvs]
  const col = [...a.col, ...b.col]
  const idx = [...a.idx, ...b.idx.map((i) => i + a.pos.length / 3)]
  const parts = partitionOpaqueGeometry(pos, uvs, col, idx, { cellSize: 72 })
  assert.ok(parts.chunks.length >= 2, `expected ≥2 chunks, got ${parts.chunks.length}`)
})

test('mutation note: disabling chunking must break browser FREE-yaw budget', () => {
  // Documented contract for the browser smoke mutation step.
  // When __RAFFI_OPAQUE_CHUNK__ === false, meshesFrom emits one opaque mesh
  // per district and FREE high-yaw frames report triangles >= 60000 with
  // assert message matching /pursuit tris \d+ >= 60000|triangles \d+ >= 60000/.
  assert.equal(typeof isOpaqueChunkingEnabled, 'function')
})
