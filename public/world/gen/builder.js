/**
 * RAFFI WORLD — mesh accumulator with baked vertex lighting.
 *
 * Everything in the city is built through this. It takes primitive calls and
 * appends them into flat typed-array buffers, applying the one directional key
 * light and ambient fill from blocks.json at *generation* time. The result is a
 * single BufferGeometry per material per district, which is how a whole city
 * fits inside 120 draw calls.
 *
 * Because lighting is baked here, the runtime scene contains no lights at all.
 */

import * as THREE from 'three'
import { hexToRgb } from '../engine/state.js'

const FACE_KEYS = ['east', 'west', 'up', 'down', 'south', 'north']

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

  /** Baked shade for a face normal, 0..~1.3. */
  shade(nx, ny, nz) {
    const L = this.lighting
    const ndotl = Math.max(0, -(nx * this.key.x + ny * this.key.y + nz * this.key.z))
    let s = L.fillStrength + L.keyStrength * ndotl

    // Directional AO — cheap, and it is what gives flat-lit boxes their form.
    const ax = Math.abs(nx)
    const ay = Math.abs(ny)
    const az = Math.abs(nz)
    let faceKey
    if (ay >= ax && ay >= az) faceKey = ny > 0 ? 'up' : 'down'
    else if (ax >= az) faceKey = nx > 0 ? 'east' : 'west'
    else faceKey = nz > 0 ? 'south' : 'north'
    s *= L.faceAO[faceKey] ?? 1

    return s
  }

  /** Darkens geometry near the ground so buildings sit instead of float. */
  contact(y) {
    const gc = this.lighting.groundContact
    if (!gc || y >= gc.height) return 1
    const t = Math.max(0, y) / gc.height
    return gc.darken + (1 - gc.darken) * t
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
    const baseShade = opts.emissive ? 1 : (opts.shadeOverride ?? this.shade(nx, ny, nz))

    // Corner UVs are plain 0/1; `uvAt` scales them into the cell sub-rect.
    const uvA = opts.flipU ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]
    const r = rect || this.atlas.uv('white')

    for (let i = 0; i < 4; i++) {
      const v = verts[i]
      this.pos.push(v.x, v.y, v.z)
      const [uu, vv] = this.atlas.uvAt(r, uvA[i][0], uvA[i][1], su, sv)
      this.uvs.push(uu, vv)
      // Contact darkening grounds vertical walls and prop sides. Applying it
      // to horizontal roads/plazas merely muddies every surface at y=0.
      const contact = Math.abs(ny) < 0.5 ? this.contact(v.y) : 1
      const s = baseShade * (opts.emissive ? 1 : contact)
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
      color = '#ffffff', rect = null, emissive = false, caps = true,
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
          { x: x + c0 * r, y: y0, z: z + s0 * r },
          { x: x + c1 * r, y: y0, z: z + s1 * r },
          { x: x + c1 * top, y: y1, z: z + s1 * top },
          { x: x + c0 * top, y: y1, z: z + s0 * top },
        ],
        color, rect2, 1, 1, { emissive }
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
          color, rect2, shade
        )
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
      this._tri(flipY ? p1 : p0, flipY ? p0 : p1, tip, color, rect2, shade)
    }
  }

  /** Faceted low-poly sphere. `seg` of 5 is the PS2-correct amount of ugly. */
  sphere(o) {
    const { x = 0, y = 0, z = 0, r = 1, seg = 5, color = '#ffffff', rect = null, emissive = false } = o
    const rings = Math.max(2, Math.floor(seg * 0.7))
    const rect2 = rect || this.atlas.uv('white')
    for (let iy = 0; iy < rings; iy++) {
      const v0 = (iy / rings) * Math.PI
      const v1 = ((iy + 1) / rings) * Math.PI
      for (let ix = 0; ix < seg; ix++) {
        const u0 = (ix / seg) * Math.PI * 2
        const u1 = ((ix + 1) / seg) * Math.PI * 2
        const p = (u, v) => ({
          x: x + r * Math.sin(v) * Math.cos(u),
          y: y + r * Math.cos(v),
          z: z + r * Math.sin(v) * Math.sin(u),
        })
        const a = p(u0, v0), b = p(u1, v0), c = p(u1, v1), d = p(u0, v1)
        if (iy === 0) this._tri(a, c, d, color, rect2, emissive ? 1 : this.shade(0, 1, 0))
        else if (iy === rings - 1) this._tri(a, b, c, color, rect2, emissive ? 1 : this.shade(0, -1, 0))
        else this.quad([a, b, c, d], color, rect2, 1, 1, { emissive })
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

  _tri(a, b, c, color, rect, shade, emissive = false) {
    const rgb = typeof color === 'string' ? hexToRgb(color) : color
    const pts = [a, b, c]
    const uvsLocal = [[0, 0], [1, 0], [0.5, 1]]
    for (let i = 0; i < 3; i++) {
      const v = pts[i]
      this.pos.push(v.x, v.y, v.z)
      const [uu, vv] = this.atlas.uvAt(rect, uvsLocal[i][0], uvsLocal[i][1])
      this.uvs.push(uu, vv)
      const s = shade * (emissive ? 1 : this.contact(v.y))
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
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/** Three builders — one per material — travelling together. */
export function makeBuilderSet(lighting, atlas) {
  return {
    opaque: new MeshBuilder(lighting, atlas),
    emissive: new MeshBuilder(lighting, atlas),
    alpha: new MeshBuilder(lighting, atlas),
    get triangleCount() {
      return this.opaque.triangleCount + this.emissive.triangleCount + this.alpha.triangleCount
    },
  }
}

/** Turns a builder set into up to three meshes on a shared Group. */
export function meshesFrom(set, materials, name = 'chunk') {
  const group = new THREE.Group()
  group.name = name
  for (const key of ['opaque', 'emissive', 'alpha']) {
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
