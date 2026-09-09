/**
 * Shared city mesh accumulator. Geometry stays merged and spatially chunked;
 * physical lighting runs on its true face normals at render time. Vertex
 * colours contain linear albedo and conservative contact occlusion only.
 */

import * as THREE from 'three'
import { hexToRgb } from '../engine/state.js'
import {
  isOpaqueChunkingEnabled,
  partitionOpaqueGeometry,
  DEFAULT_CELL,
  DEFAULT_SPILL_EXTENT,
} from './chunk-opaque.js'

export class MeshBuilder {
  /**
   * @param lighting  blocks.json `vertexLighting`
   * @param atlas     the atlas module's `uv()`/`uvAt()` pair
   */
  constructor(lighting, atlas) {
    this.lighting = lighting
    this.atlas = atlas
    this.pos = []
    this.uvs = []
    this.normals = []
    this.col = []
    this.idx = []
    this.vertCount = 0

    const d = lighting.keyDir || { x: -0.4, y: -0.85, z: 0.35 }
    const len = Math.hypot(d.x, d.y, d.z) || 1
    this.key = { x: d.x / len, y: d.y / len, z: d.z / len }
  }

  /** Directional key direction can differ per grade; generators may override. */
  setKeyDir(d) {
    const len = Math.hypot(d.x, d.y, d.z) || 1
    this.key = { x: d.x / len, y: d.y / len, z: d.z / len }
  }

  /** Directional light belongs to the renderer; only enclosed undersides occlude. */
  shade(nx, ny, nz) {
    return ny < -0.5 ? 0.78 : 1
  }

  /** Darkens geometry near the ground so buildings sit instead of float. */
  contact(y) {
    const gc = this.lighting.groundContact
    if (!gc || y >= gc.height) return 1
    const t = Math.max(0, y) / gc.height
    return 0.9 + 0.1 * t
  }

  /**
   * Soft sky-fill along height — upper facades wash brighter, like Gouraud
   * ambient on early-2000s city games. Breaks the flat Minecraft slab read.
   */
  heightAmb(y) {
    const ha = this.lighting.heightAmbient
    if (!ha) return 1
    const span = Math.max(0.001, (ha.maxY ?? 80) - (ha.minY ?? 0))
    const t = Math.max(0, Math.min(1, (y - (ha.minY ?? 0)) / span))
    const bottom = 0.97
    const top = 1
    return bottom + (top - bottom) * t
  }

  /**
   * Appends one quad. Vertices must be given counter-clockwise when seen from
   * the visible side.
   * @param verts  four {x,y,z}
   * @param color  '#rrggbb' or {r,g,b} 0..1
   * @param rect   atlas uv rect
   * @param su,sv  fraction of the cell to cover (window-grid trick)
   * @param opts   { emissive, shadeOverride, flipU }
   */
  quad(verts, color, rect, su = 1, sv = 1, opts = {}) {
    const [a, b, c, d] = verts

    // Face normal from the first triangle.
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
    const vx = d.x - a.x, vy = d.y - a.y, vz = d.z - a.z
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl; ny /= nl; nz /= nl

    const rgb = typeof color === 'string' ? hexToRgb(color) : color
    const baseShade = opts.emissive ? 1 : this.shade(nx, ny, nz)

    // Corner UVs are plain 0/1; `uvAt` scales them into the cell sub-rect.
    const uvA = opts.flipU ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]
    const r = rect || this.atlas.uv('white')

    for (let i = 0; i < 4; i++) {
      const v = verts[i]
      this.pos.push(v.x, v.y, v.z)
      const normal = opts.normals?.[i] || { x: nx, y: ny, z: nz }
      this.normals.push(normal.x, normal.y, normal.z)
      const [uu, vv] = this.atlas.uvAt(r, uvA[i][0], uvA[i][1], su, sv)
      this.uvs.push(uu, vv)
      // Contact darkening grounds vertical walls and prop sides. Applying it
      // to horizontal roads/plazas merely muddies every surface at y=0.
      // Height ambient gives walls a soft top-to-bottom wash (PS2 Gouraud).
      const wall = Math.abs(ny) < 0.5
      const contact = wall ? this.contact(v.y) : 1
      const height = wall && !opts.emissive ? this.heightAmb(v.y) : 1
      const s = baseShade * (opts.emissive ? 1 : contact * height)
      this.col.push(rgb.r * s, rgb.g * s, rgb.b * s)
    }

    const o = this.vertCount
    this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
    this.vertCount += 4
  }

  /**
   * Axis-aligned box, optionally rotated about Y.
   * `faces` lets a caller skip hidden sides — under a fixed camera the two
   * back walls of every building are never visible, which is most of the
   * triangle budget saved.
   */
  box(o) {
    const {
      x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, ry = 0,
      color = '#ffffff', rect = null, su = 1, sv = 1,
      faces = null, emissive = false, topRect = null, topColor = null,
    } = o

    const hw = w / 2
    const hd = d / 2
    const cos = Math.cos(ry)
    const sin = Math.sin(ry)
    const P = (lx, ly, lz) => ({
      x: x + lx * cos - lz * sin,
      y: y + ly,
      z: z + lx * sin + lz * cos,
    })

    const y0 = -h / 2
    const y1 = h / 2

    const want = (name) => !faces || faces.includes(name)

    // +X
    if (want('east')) this.quad([P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd)], color, rect, su, sv, { emissive })
    // -X
    if (want('west')) this.quad([P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd)], color, rect, su, sv, { emissive })
    // +Z
    if (want('south')) this.quad([P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd)], color, rect, su, sv, { emissive })
    // -Z
    if (want('north')) this.quad([P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd)], color, rect, su, sv, { emissive })
    // +Y
    if (want('up')) this.quad([P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd)], topColor || color, topRect || rect, 1, 1, { emissive })
    // -Y
    if (want('down')) this.quad([P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd)], color, rect, 1, 1, { emissive })
  }

  /** Ground-plane (or arbitrary-Y) horizontal quad. */
  plane(o) {
    const { x = 0, y = 0, z = 0, w = 1, d = 1, ry = 0, color = '#ffffff', rect = null, emissive = false, su = 1, sv = 1 } = o
    const hw = w / 2
    const hd = d / 2
    const cos = Math.cos(ry)
    const sin = Math.sin(ry)
    const P = (lx, lz) => ({ x: x + lx * cos - lz * sin, y, z: z + lx * sin + lz * cos })
    this.quad([P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd)], color, rect, su, sv, { emissive, shadeOverride: emissive ? 1 : undefined })
  }

  /** Vertical billboard quad facing +Z before rotation — signs, decals. */
  billboard(o) {
    const { x = 0, y = 0, z = 0, w = 1, h = 1, ry = 0, color = '#ffffff', rect = null, emissive = false } = o
    const hw = w / 2
    const cos = Math.cos(ry)
    const sin = Math.sin(ry)
    const P = (lx, ly) => ({ x: x + lx * cos, y: y + ly, z: z + lx * sin })
    this.quad([P(-hw, -h / 2), P(hw, -h / 2), P(hw, h / 2), P(-hw, h / 2)], color, rect, 1, 1, { emissive, shadeOverride: emissive ? 1 : 0.95 })
  }

  cylinder(o) {
    const {
      x = 0, y = 0, z = 0, r = 0.5, rTop = null, h = 1, seg = 6, ry = 0,
      color = '#ffffff', rect = null, emissive = false, caps = true, smooth = true,
    } = o
    const top = rTop === null ? r : rTop
    const y0 = y - h / 2
    const y1 = y + h / 2
    const rect2 = rect || this.atlas.uv('white')

    for (let i = 0; i < seg; i++) {
      const a0 = ry + (i / seg) * Math.PI * 2
      const a1 = ry + ((i + 1) / seg) * Math.PI * 2
      const c0 = Math.cos(a0), s0 = Math.sin(a0)
      const c1 = Math.cos(a1), s1 = Math.sin(a1)
      this.quad(
        [
          { x: x + c1 * r, y: y0, z: z + s1 * r },
          { x: x + c0 * r, y: y0, z: z + s0 * r },
          { x: x + c0 * top, y: y1, z: z + s0 * top },
          { x: x + c1 * top, y: y1, z: z + s1 * top },
        ],
        color, rect2, 1, 1, { emissive, normals: smooth ? [c1, c0, c0, c1].map((c, j) => {
          const sy = (r - top) / Math.max(h, 0.001)
          const len = Math.hypot(1, sy)
          return { x: c / len, y: sy / len, z: [s1, s0, s0, s1][j] / len }
        }) : null }
      )
    }

    if (caps && top > 0.001) {
      const shade = emissive ? 1 : this.shade(0, 1, 0)
      const centre = { x, y: y1, z }
      for (let i = 0; i < seg; i++) {
        const a0 = ry + (i / seg) * Math.PI * 2
        const a1 = ry + ((i + 1) / seg) * Math.PI * 2
        this._tri(
          centre,
          { x: x + Math.cos(a1) * top, y: y1, z: z + Math.sin(a1) * top },
          { x: x + Math.cos(a0) * top, y: y1, z: z + Math.sin(a0) * top },
          color, rect2, shade, emissive
        )
      }
    }
    if (caps && r > 0.001) {
      const centre = { x, y: y0, z }
      for (let i = 0; i < seg; i++) {
        const a0 = ry + i / seg * Math.PI * 2
        const a1 = ry + (i + 1) / seg * Math.PI * 2
        this._tri(centre,
          { x: x + Math.cos(a0) * r, y: y0, z: z + Math.sin(a0) * r },
          { x: x + Math.cos(a1) * r, y: y0, z: z + Math.sin(a1) * r },
          color, rect2, 0.78, emissive)
      }
    }
  }

  cone(o) {
    const { x = 0, y = 0, z = 0, r = 0.5, h = 1, seg = 6, ry = 0, color = '#ffffff', rect = null, emissive = false, flipY = false } = o
    const rect2 = rect || this.atlas.uv('white')
    const yBase = flipY ? y + h / 2 : y - h / 2
    const yTip = flipY ? y - h / 2 : y + h / 2
    for (let i = 0; i < seg; i++) {
      const a0 = ry + (i / seg) * Math.PI * 2
      const a1 = ry + ((i + 1) / seg) * Math.PI * 2
      const p0 = { x: x + Math.cos(a0) * r, y: yBase, z: z + Math.sin(a0) * r }
      const p1 = { x: x + Math.cos(a1) * r, y: yBase, z: z + Math.sin(a1) * r }
      const tip = { x, y: yTip, z }
      const nx = (p0.x + p1.x) / 2 - x
      const nz = (p0.z + p1.z) / 2 - z
      const shade = emissive ? 1 : this.shade(nx, 0.4, nz)
      this._tri(flipY ? p0 : p1, flipY ? p1 : p0, tip, color, rect2, shade, emissive)
    }
  }

  /** Smooth ellipsoid; analytic normals survive merging and district partition. */
  sphere(o) {
    const {
      x = 0, y = 0, z = 0, r = 1, seg = 10, rings = Math.max(3, Math.floor(seg * 0.7)),
      sx = 1, sy = 1, sz = 1, ry = 0, smooth = true,
      color = '#ffffff', rect = null, emissive = false,
    } = o
    const rect2 = rect || this.atlas.uv('white')
    const co = Math.cos(ry), si = Math.sin(ry)
    const point = (u, v) => {
      const nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u)
      const lx = r * nx * sx, lz = r * nz * sz
      const ax = nx / sx, ay = ny / sy, az = nz / sz
      const len = Math.hypot(ax, ay, az) || 1
      return {
        p: { x: x + lx * co - lz * si, y: y + r * ny * sy, z: z + lx * si + lz * co },
        n: { x: (ax * co - az * si) / len, y: ay / len, z: (ax * si + az * co) / len },
      }
    }
    if (smooth) {
      const offset = this.vertCount
      const rgb = typeof color === 'string' ? hexToRgb(color) : color
      // Share latitude-ring vertices inside each rounded primitive. Besides
      // reducing buffers this keeps CPU-animated people inexpensive to deform.
      for (let iy = 0; iy <= rings; iy++) {
        for (let ix = 0; ix <= seg; ix++) {
          const { p, n } = point(ix / seg * Math.PI * 2, iy / rings * Math.PI)
          this.pos.push(p.x, p.y, p.z)
          this.normals.push(n.x, n.y, n.z)
          this.uvs.push(...this.atlas.uvAt(rect2, ix / seg, 1 - iy / rings))
          const shade = emissive ? 1 : this.contact(p.y) * this.heightAmb(p.y)
          this.col.push(rgb.r * shade, rgb.g * shade, rgb.b * shade)
          this.vertCount++
        }
      }
      for (let iy = 0; iy < rings; iy++) {
        for (let ix = 0; ix < seg; ix++) {
          const a = offset + iy * (seg + 1) + ix, b = a + 1
          const d = a + seg + 1, c = d + 1
          if (iy > 0) this.idx.push(a, b, c)
          if (iy < rings - 1) this.idx.push(a, c, d)
        }
      }
      return
    }
    for (let iy = 0; iy < rings; iy++) {
      for (let ix = 0; ix < seg; ix++) {
        const u0 = ix / seg * Math.PI * 2, u1 = (ix + 1) / seg * Math.PI * 2
        const v0 = iy / rings * Math.PI, v1 = (iy + 1) / rings * Math.PI
        const a = point(u0, v0), b = point(u1, v0), c = point(u1, v1), d = point(u0, v1)
        if (iy === 0) this._tri(a.p, c.p, d.p, color, rect2, 1, emissive, smooth ? [a.n, c.n, d.n] : null)
        else if (iy === rings - 1) this._tri(a.p, b.p, c.p, color, rect2, 1, emissive, smooth ? [a.n, b.n, c.n] : null)
        else this.quad([a.p, b.p, c.p, d.p], color, rect2, 1, 1, { emissive, normals: smooth ? [a.n, b.n, c.n, d.n] : null })
      }
    }
  }

  /** Drivable wedge — the ramps in The Yards. Slope faces +Z. */
  wedge(o) {
    const { x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, ry = 0, color = '#ffffff', rect = null } = o
    const hw = w / 2, hd = d / 2
    const cos = Math.cos(ry), sin = Math.sin(ry)
    const P = (lx, ly, lz) => ({ x: x + lx * cos - lz * sin, y: y + ly, z: z + lx * sin + lz * cos })
    const y0 = -h / 2
    const y1 = h / 2
    // Slope
    this.quad([P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, -hd), P(-hw, y1, -hd)], color, rect)
    // Back
    this.quad([P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd)], color, rect)
    // Sides
    this._tri(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), color, rect || this.atlas.uv('white'), this.shade(1, 0, 0))
    this._tri(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, -hd), color, rect || this.atlas.uv('white'), this.shade(-1, 0, 0))
    // Bottom
    this.quad([P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd)], color, rect)
  }

  _tri(a, b, c, color, rect, shade, emissive = false, normals = null) {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const nl = Math.hypot(nx, ny, nz) || 1
    const rgb = typeof color === 'string' ? hexToRgb(color) : color
    const pts = [a, b, c]
    const uvsLocal = [[0, 0], [1, 0], [0.5, 1]]
    for (let i = 0; i < 3; i++) {
      const v = pts[i]
      this.pos.push(v.x, v.y, v.z)
      const normal = normals?.[i] || { x: nx / nl, y: ny / nl, z: nz / nl }
      this.normals.push(normal.x, normal.y, normal.z)
      const [uu, vv] = this.atlas.uvAt(rect, uvsLocal[i][0], uvsLocal[i][1])
      this.uvs.push(uu, vv)
      const s = emissive ? 1 : Math.min(1, shade) * this.contact(v.y)
      this.col.push(rgb.r * s, rgb.g * s, rgb.b * s)
    }
    const o = this.vertCount
    this.idx.push(o, o + 1, o + 2)
    this.vertCount += 3
  }

  get triangleCount() { return this.idx.length / 3 }
  get isEmpty() { return this.idx.length === 0 }

  build() {
    if (this.isEmpty) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setIndex(this.idx)
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/** Shared material streams, plus independently bounded fine opaque detail. */
export function makeBuilderSet(lighting, atlas) {
  return {
    opaque: new MeshBuilder(lighting, atlas),
    detail: new MeshBuilder(lighting, atlas),
    emissive: new MeshBuilder(lighting, atlas),
    alpha: new MeshBuilder(lighting, atlas),
    get triangleCount() {
      return this.opaque.triangleCount + this.detail.triangleCount + this.emissive.triangleCount + this.alpha.triangleCount
    },
  }
}

/**
 * Turns a builder set into meshes on a shared Group.
 *
 * Solid city surfaces, including opaque emission, use spatial bounds. Alpha
 * stays one mesh per district because splitting it changes transparent sort.
 */
export function meshesFrom(set, materials, name = 'chunk') {
  const group = new THREE.Group()
  group.name = name

  // --- opaque (chunked when enabled) ---
  if (!set.opaque.isEmpty) {
    if (isOpaqueChunkingEnabled()) {
      const built = buildChunkedOpaque(set.opaque, materials.opaque, name)
      for (const mesh of built) group.add(mesh)
    } else {
      const geo = set.opaque.build()
      if (geo) {
        const mesh = new THREE.Mesh(geo, materials.opaque)
        mesh.name = `${name}:opaque`
        mesh.frustumCulled = true
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        group.add(mesh)
      }
    }
  }

  // Fine trim keeps its exact near geometry, but has independent bounds so
  // distant streets do not submit subpixel rails and window hardware.
  if (set.detail && !set.detail.isEmpty) {
    for (const mesh of buildChunkedOpaque(set.detail, materials.opaque, `${name}:detail`)) {
      mesh.userData.opaqueDetail = true
      group.add(mesh)
    }
  }

  // Emission writes depth like masonry, so it benefits from the same exact
  // spatial partition. A distant lamp must not submit every city sign.
  for (const key of ['emissive', 'alpha']) {
    if (key === 'emissive' && !set[key].isEmpty && isOpaqueChunkingEnabled()) {
      for (const mesh of buildChunkedOpaque(set[key], materials[key], name, key)) group.add(mesh)
      continue
    }
    const geo = set[key].build()
    if (!geo) continue
    const mesh = new THREE.Mesh(geo, materials[key])
    mesh.name = `${name}:${key}`
    mesh.frustumCulled = true
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    group.add(mesh)
  }

  return group
}

/**
 * Build compact opaque chunk meshes from a MeshBuilder's buffers without
 * going through a single giant geometry first when possible.
 */
function buildChunkedOpaque(builder, material, name, kind = 'opaque') {
  const pos = builder.pos
  const uvs = builder.uvs
  const col = builder.col
  const idx = builder.idx
  const parts = partitionOpaqueGeometry(pos, uvs, col, idx, {
    cellSize: DEFAULT_CELL,
    spillExtent: DEFAULT_SPILL_EXTENT,
    normals: builder.normals,
  })

  const meshes = []
  const all = [...parts.chunks]
  if (parts.spill) all.push(parts.spill)

  for (const part of all) {
    const geo = geometryFromChunk(part)
    if (!geo) continue
    const mesh = new THREE.Mesh(geo, material)
    mesh.name = part.key === 'spill'
      ? `${name}:${kind}:spill`
      : `${name}:${kind}:${part.key}`
    mesh.frustumCulled = true
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    // Tag for runtime fog depth cull (opaque city only).
    mesh.userData.opaqueChunk = true
    mesh.userData.chunkKey = part.key
    meshes.push(mesh)
  }
  return meshes
}

function geometryFromChunk(part) {
  if (!part.indices.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(part.colors, 3))
  const use32 = part.positions.length / 3 > 65535
  g.setIndex(
    use32
      ? new THREE.Uint32BufferAttribute(part.indices, 1)
      : new THREE.Uint16BufferAttribute(part.indices, 1)
  )
  if (part.normals?.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3))
  else g.computeVertexNormals()
  // Tight bounds — the whole reason chunking reduces visible tris under FREE.
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
