/**
 * RAFFI WORLD — spatial partition of district OPAQUE geometry only.
 *
 * Why: each district is one giant opaque mesh. FREE / high-yaw views keep that
 * whole mesh in frustum, so WebGL reports 60k+ visible tris. Chunking preserves
 * every triangle but lets frustum + fog cull drop off-screen city mass.
 *
 * Emissive and alpha stay single meshes (alpha is transparent depthWrite:false;
 * splitting it changes Three's object-level sort).
 *
 * Disable with globalThis.__RAFFI_OPAQUE_CHUNK__ = false for mutation tests.
 */

/** @typedef {{ cx: number, cz: number, key: string, positions: number[], uvs: number[], colors: number[], indices: number[] }} OpaqueChunk */

/**
 * Cell size balances FREE-yaw frustum savings vs draw-call count.
 * ~200 m keeps district opaque meshes in the low tens, not 100+.
 */
export const DEFAULT_CELL = 140
/** Triangle AABB extent above this goes to spill (ground pads / road decks). */
export const DEFAULT_SPILL_EXTENT = 48

/**
 * Feature flag — mutation tests flip this off to prove the browser budget fails.
 * Default: chunking ON.
 */
export function isOpaqueChunkingEnabled() {
  if (typeof globalThis !== 'undefined' && globalThis.__RAFFI_OPAQUE_CHUNK__ === false) {
    return false
  }
  if (typeof globalThis !== 'undefined' && globalThis.__RAFFI_OPAQUE_CHUNK__ === true) {
    return true
  }
  return true
}

/**
 * Partition an indexed triangle soup into spatial cells + a spill bucket.
 * Preserves vertex attributes and winding exactly (no weld / reorder of verts
 * within a triangle; only which bucket a triangle is appended to).
 *
 * @param {Float32Array|number[]} pos
 * @param {Float32Array|number[]} uvs
 * @param {Float32Array|number[]} colors
 * @param {Uint16Array|Uint32Array|number[]} indices
 * @param {{ cellSize?: number, spillExtent?: number }} [opts]
 * @returns {{ chunks: OpaqueChunk[], spill: OpaqueChunk|null, triangleCount: number }}
 */
export function partitionOpaqueGeometry(pos, uvs, colors, indices, opts = {}) {
  const cellSize = opts.cellSize ?? DEFAULT_CELL
  const spillExtent = opts.spillExtent ?? DEFAULT_SPILL_EXTENT
  /** @type {Map<string, OpaqueChunk>} */
  const map = new Map()
  /** @type {OpaqueChunk} */
  const spill = emptyChunk('spill', 0, 0)
  let triCount = 0

  const triN = Math.floor(indices.length / 3)
  for (let t = 0; t < triN; t++) {
    const i0 = indices[t * 3]
    const i1 = indices[t * 3 + 1]
    const i2 = indices[t * 3 + 2]
    const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2]
    const bx = pos[i1 * 3], by = pos[i1 * 3 + 1], bz = pos[i1 * 3 + 2]
    const cx = pos[i2 * 3], cy = pos[i2 * 3 + 1], cz = pos[i2 * 3 + 2]

    const minX = Math.min(ax, bx, cx)
    const maxX = Math.max(ax, bx, cx)
    const minY = Math.min(ay, by, cy)
    const maxY = Math.max(ay, by, cy)
    const minZ = Math.min(az, bz, cz)
    const maxZ = Math.max(az, bz, cz)
    const ext = Math.max(maxX - minX, maxY - minY, maxZ - minZ)

    const mx = (ax + bx + cx) / 3
    const mz = (az + bz + cz) / 3

    /** @type {OpaqueChunk} */
    let bucket
    if (ext >= spillExtent) {
      bucket = spill
    } else {
      const cxCell = Math.floor(mx / cellSize)
      const czCell = Math.floor(mz / cellSize)
      const key = cxCell + '_' + czCell
      bucket = map.get(key)
      if (!bucket) {
        bucket = emptyChunk(key, cxCell, czCell)
        map.set(key, bucket)
      }
    }

    appendTri(bucket, pos, uvs, colors, i0, i1, i2)
    triCount++
  }

  const chunks = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return {
    chunks,
    spill: spill.indices.length ? spill : null,
    triangleCount: triCount,
  }
}

/**
 * Compact signature of every triangle for equality tests (order-independent).
 * Each tri is min-lex vertex triple of packed coords so winding is encoded
 * by the cyclic order after rotating the minimum vertex to front.
 */
export function triangleSignature(pos, indices) {
  const out = []
  const triN = Math.floor(indices.length / 3)
  for (let t = 0; t < triN; t++) {
    const i0 = indices[t * 3]
    const i1 = indices[t * 3 + 1]
    const i2 = indices[t * 3 + 2]
    const v0 = packV(pos, i0)
    const v1 = packV(pos, i1)
    const v2 = packV(pos, i2)
    // Canonical rotation preserving winding.
    let a = v0, b = v1, c = v2
    if (v1 < a && v1 <= v2) { a = v1; b = v2; c = v0 }
    else if (v2 < a && v2 <= v1) { a = v2; b = v0; c = v1 }
    out.push(a + '|' + b + '|' + c)
  }
  out.sort()
  return out
}

/**
 * Full attribute signature including UVs and colours (winding-preserving).
 */
export function triangleAttrSignature(pos, uvs, colors, indices) {
  const out = []
  const triN = Math.floor(indices.length / 3)
  for (let t = 0; t < triN; t++) {
    const i0 = indices[t * 3]
    const i1 = indices[t * 3 + 1]
    const i2 = indices[t * 3 + 2]
    const pack = (i) =>
      packV(pos, i) +
      ',u' + f(uvs[i * 2]) + ',' + f(uvs[i * 2 + 1]) +
      ',c' + f(colors[i * 3]) + ',' + f(colors[i * 3 + 1]) + ',' + f(colors[i * 3 + 2])
    const v0 = pack(i0)
    const v1 = pack(i1)
    const v2 = pack(i2)
    let a = v0, b = v1, c = v2
    if (v1 < a && v1 <= v2) { a = v1; b = v2; c = v0 }
    else if (v2 < a && v2 <= v1) { a = v2; b = v0; c = v1 }
    out.push(a + '|' + b + '|' + c)
  }
  out.sort()
  return out
}

/** Axis-aligned bounds of a chunk's positions. */
export function chunkBounds(chunk) {
  const p = chunk.positions
  if (!p.length) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, extent: 0 }
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  return {
    minX, minY, minZ, maxX, maxY, maxZ,
    extent: Math.max(maxX - minX, maxY - minY, maxZ - minZ),
  }
}

function emptyChunk(key, cx, cz) {
  return { cx, cz, key, positions: [], uvs: [], colors: [], indices: [] }
}

function appendTri(bucket, pos, uvs, colors, i0, i1, i2) {
  const base = bucket.positions.length / 3
  for (const i of [i0, i1, i2]) {
    bucket.positions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    bucket.uvs.push(uvs[i * 2], uvs[i * 2 + 1])
    bucket.colors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
  }
  bucket.indices.push(base, base + 1, base + 2)
}

function packV(pos, i) {
  return f(pos[i * 3]) + ',' + f(pos[i * 3 + 1]) + ',' + f(pos[i * 3 + 2])
}

function f(n) {
  // Stable string for float equality across rebuilds.
  return (Math.round(n * 1e5) / 1e5).toFixed(5)
}
