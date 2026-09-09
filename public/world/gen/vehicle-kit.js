/** Original street-vehicle kit: shaped sheet metal, wheel openings and glazed cabins.
 * All surfaces share the physical atlas so a complete vehicle remains one
 * instanced draw. The coarse variant removes small fittings and wheel detail.
 */
import * as THREE from 'three'
import { hexToRgb } from '../engine/state.js'
import { MeshBuilder } from './builder.js'

const v = (x, y, z) => ({ x, y, z })

function append(builder, geometry, color, tile) {
  const start = builder.vertCount, rgb = hexToRgb(color)
  const p = geometry.attributes.position, n = geometry.attributes.normal
  const index = geometry.index?.array || Array.from({ length: p.count }, (_, i) => i)
  const used = [...new Set(index)], remap = new Map(used.map((value, i) => [value, i]))
  for (const i of used) {
    builder.pos.push(p.getX(i), p.getY(i), p.getZ(i))
    builder.normals.push(n.getX(i), n.getY(i), n.getZ(i))
    const uv = builder.atlas.uvAt(tile, (p.getX(i) + p.getZ(i)) % 1 * .45 + .5, p.getY(i) % 1 * .45 + .5)
    builder.uvs.push(...uv)
    const shade = n.getY(i) < -.5 ? .82 : 1
    builder.col.push(rgb.r * shade, rgb.g * shade, rgb.b * shade)
  }
  for (const i of index) builder.idx.push(start + remap.get(i))
  builder.vertCount += used.length
  geometry.dispose()
  return { start, end: builder.vertCount }
}

// Three subdivisions place vertices on the actual bevel rather than spending
// a uniform grid across the flat panels. Normals follow the rounded surface.
function rounded(builder, { x = 0, y = 0, z = 0, w, h, d, r = .04, color, tile, ry = 0 }) {
  r = Math.min(r, w * .45, h * .45, d * .45)
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3)
  const p = g.attributes.position, n = g.attributes.normal
  const size = [w, h, d], normal = new THREE.Vector3(), point = new THREE.Vector3()
  const cs = Math.cos(ry), sn = Math.sin(ry)
  for (let i = 0; i < p.count; i++) {
    const src = [p.getX(i), p.getY(i), p.getZ(i)]
    const q = src.map((value, axis) => Math.sign(value) * (size[axis] / 2 - (Math.abs(value) > .4 ? 0 : r)))
    const core = q.map((value, axis) => THREE.MathUtils.clamp(value, -size[axis] / 2 + r, size[axis] / 2 - r))
    normal.set(q[0] - core[0], q[1] - core[1], q[2] - core[2]).normalize()
    point.set(core[0] + normal.x * r, core[1] + normal.y * r, core[2] + normal.z * r)
    p.setXYZ(i, x + point.x * cs + point.z * sn, y + point.y, z - point.x * sn + point.z * cs)
    n.setXYZ(i, normal.x * cs + normal.z * sn, normal.y, -normal.x * sn + normal.z * cs)
  }
  return append(builder, g, color, tile)
}

function range(builder, fn, color) {
  const start = builder.vertCount
  fn()
  const end = builder.vertCount, rgb = hexToRgb(color), channels = [rgb.r, rgb.g, rgb.b]
  const channel = channels.indexOf(Math.max(...channels)), shade = new Float32Array(end - start)
  for (let i = start; i < end; i++) shade[i - start] = builder.col[i * 3 + channel] / Math.max(channels[channel], 1e-6)
  return { start, end, shade }
}

function panel(builder, points, color, tile, inset = 0) {
  if (inset) {
    const centre = points.reduce((c, p) => v(c.x + p.x / 4, c.y + p.y / 4, c.z + p.z / 4), v(0, 0, 0))
    points = points.map(p => v(p.x + (centre.x - p.x) * inset, p.y + (centre.y - p.y) * inset, p.z + (centre.z - p.z) * inset))
  }
  builder.quad(points, color, tile)
}

function rod(builder, a, b, width, color, tile) {
  const start = builder.vertCount
  builder.cylinder({ r: width / 2, h: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), seg: 6, color, rect: tile })
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize())
  const p = new THREE.Vector3(), n = new THREE.Vector3()
  for (let i = start; i < builder.vertCount; i++) {
    const o = i * 3
    p.fromArray(builder.pos, o).applyQuaternion(q).add(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2))
    n.fromArray(builder.normals, o).applyQuaternion(q)
    p.toArray(builder.pos, o); n.toArray(builder.normals, o)
  }
}

function wheel(builder, { x, z, radius, width, side, detail, atlas }) {
  const start = builder.vertCount, seg = detail ? 24 : 10
  const rings = detail ? [[-.5, .77], [-.5, .9], [-.34, 1], [.34, 1], [.5, .9], [.5, .68]] : [[-.5, .8], [-.32, 1], [.32, 1], [.5, .74]]
  const P = (ring, a) => v(x + ring[0] * width, radius + Math.cos(a) * radius * ring[1], z + Math.sin(a) * radius * ring[1])
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < seg; s++) {
    const a = s / seg * Math.PI * 2, b = (s + 1) / seg * Math.PI * 2
    const points = [P(rings[r], a), P(rings[r], b), P(rings[r + 1], b), P(rings[r + 1], a)]
    const dr = (rings[r + 1][1] - rings[r][1]) * radius, dx = (rings[r + 1][0] - rings[r][0]) * width
    const len = Math.hypot(dr, dx), normals = [a, b, b, a].map(angle => v(-dr / len, Math.cos(angle) * dx / len, Math.sin(angle) * dx / len))
    builder.quad(points, '#d2d2d2', atlas.uv('car-rubber'), 1, 1, { normals })
  }
  const outerX = x + side * width * .505
  const disc = (r, color, offset = 0) => {
    for (let s = 0; s < seg; s++) {
      const a = s / seg * Math.PI * 2, b = (s + 1) / seg * Math.PI * 2
      const p0 = v(outerX + side * offset, radius + Math.cos(a) * r, z + Math.sin(a) * r)
      const p1 = v(outerX + side * offset, radius + Math.cos(b) * r, z + Math.sin(b) * r)
      builder._tri(v(outerX + side * offset, radius, z), side > 0 ? p0 : p1, side > 0 ? p1 : p0, color, atlas.uv('car-chrome'), 1)
    }
  }
  disc(radius * .73, '#454b50')
  if (detail) {
    // Five swept alloy spokes expose the darker brake disc beneath them.
    for (let s = 0; s < 5; s++) {
      const a = s / 5 * Math.PI * 2
      const point = (r, angle) => v(outerX + side * .016, radius + Math.cos(angle) * r, z + Math.sin(angle) * r)
      const points = [point(radius * .17, a - .25), point(radius * .68, a - .12), point(radius * .68, a + .12), point(radius * .17, a + .4)]
      panel(builder, side > 0 ? points : points.toReversed(), '#c7c9ca', atlas.uv('car-chrome'))
    }
    disc(radius * .2, '#9b9fa2', .024)
  } else disc(radius * .53, '#a0a6ab', .012)
  return { start, end: builder.vertCount, front: z > 0, pivot: { x, y: radius, z } }
}

export function buildStreetVehicle({ archetype, appearance = {}, silhouette: S, length, width, paint, atlas, lighting, detail = true }) {
  const b = new MeshBuilder(lighting, atlas), white = atlas.uv('white'), metal = atlas.uv('car-paint')
  const rubber = atlas.uv('car-rubber'), chrome = atlas.uv('car-chrome'), glass = atlas.uv('car-glass')
  const [bodyColor, roofColor] = paint, wr = S.wheelRadius
  const van = archetype === 'van', bus = archetype === 'bus', truck = Boolean(S.boxBody), pickup = Boolean(S.bed)
  const sport = appearance.bodyStyle === 'sport' || archetype === 'coupe-sport' || archetype === 'grand-tourer'
  const suv = appearance.bodyStyle === 'suv'
  const wagon = archetype === 'wagon' || suv, hatch = archetype === 'compact'
  const utility = van || bus || truck || pickup
  const belt = bus ? 1.3 : truck ? 1.2 : pickup ? 1.08 : van ? 1.12 : suv ? 1.11 : sport ? .82 : .94
  const roof = bus ? 2.9 : van ? 2.3 : truck ? 2.35 : pickup ? 1.88 : suv ? 1.86 : sport ? 1.31 : hatch ? 1.52 : wagon ? 1.55 : 1.47
  const cabFront = length / 2 - S.hood.length + (van || bus ? .14 : 0)
  const cabRear = pickup || truck ? cabFront - S.cabin.length : van || bus || wagon || hatch ? -length / 2 + .22 : cabFront - S.cabin.length
  const roofFront = cabFront - (bus ? .16 : van || truck ? .28 : sport ? .62 : .5)
  const roofRear = cabRear + (van || bus || wagon ? .12 : hatch ? .24 : sport ? .45 : .34)
  const cabW = width * (utility ? .465 : .465), roofW = width * (van || bus || truck ? .438 : pickup ? .415 : .38)
  const hullRanges = [], cabinRanges = [], wheels = [], heads = [], tails = []
  const box = (o, color = '#24292d', tile = rubber) => b.box({ ...o, color, rect: tile })
  const round = (o, color = bodyColor, tile = metal) => detail ? rounded(b, { ...o, color, tile }) : box(o, color, tile)
  const marking = (index) => {
    const r = atlas.uv('fleet-markings'), du = (r.u1 - r.u0) / 2, dv = (r.v1 - r.v0) / 2
    const col = index % 2, row = 1 - Math.floor(index / 2), pad = .001
    return { ...r, u0: r.u0 + col * du + pad, u1: r.u0 + (col + 1) * du - pad, v0: r.v0 + row * dv + pad, v1: r.v0 + (row + 1) * dv - pad }
  }
  const sideDecal = (side, y, z, w, h, tile) => b.billboard({ x: side * (width / 2 + .009), y, z, w, h, ry: side * Math.PI / 2, color: '#ffffff', rect: tile })

  // Longitudinal sheet-metal rings leave genuinely open wheel arches. The
  // floor pan is narrower and lower, so tires do not intersect a solid box.
  hullRanges.push(range(b, () => {
    const zValues = new Set([-length / 2, -length / 2 + .1, length / 2 - .1, length / 2])
    const steps = detail ? 28 : 12
    for (let i = 1; i < steps; i++) zValues.add(-length / 2 + length * i / steps)
    for (const cz of [-S.wheelbase / 2, S.wheelbase / 2]) for (let i = 0; i <= (detail ? 14 : 6); i++) {
      const a = i / (detail ? 14 : 6) * Math.PI
      zValues.add(cz + Math.cos(a) * (wr + .07))
    }
    const zs = [...new Set([...zValues].filter(z => Math.abs(z) <= length / 2).map(z => Math.round(z * 1e6) / 1e6))].sort((a, b) => a - b)
    const pos = [], idx = []
    for (const z of zs) {
      const end = Math.max(0, (Math.abs(z) - (length / 2 - .32)) / .32)
      const w = width / 2 * (1 - .08 * end), top = belt - .08 * end
      let bottom = utility ? .25 : .21
      for (const cz of [-S.wheelbase / 2, S.wheelbase / 2]) {
        const dz = Math.abs(z - cz), r = wr + .07
        if (dz <= r) bottom = Math.max(bottom, wr + Math.sqrt(Math.max(0, r * r - dz * dz)))
      }
      const sideMid = Math.max(bottom + .025, top - .11)
      for (const [x, y] of [[-w * .975, bottom], [-w, sideMid], [-w * .97, top - .03], [-w * .82, top + .025], [0, top + .04], [w * .82, top + .025], [w * .97, top - .03], [w, sideMid], [w * .975, bottom]]) pos.push(x, y, z)
    }
    for (let r = 0; r < zs.length - 1; r++) for (let j = 0; j < 8; j++) {
      if (pickup && zs[r + 1] < cabRear + .04 && (j === 3 || j === 4)) continue
      const a = r * 9 + j, c = (r + 1) * 9 + j
      idx.push(a, c, c + 1, a, c + 1, a + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
    append(b, g, bodyColor, metal)
    round({ x: 0, y: belt - .23, z: length / 2 - .055, w: width * .97, h: .4, d: .18, r: .065 })
    round({ x: 0, y: belt - .23, z: -length / 2 + .055, w: width * .97, h: .4, d: .18, r: .065 })
  }, bodyColor))
  box({ x: 0, y: .24, z: 0, w: width * .7, h: .14, d: S.wheelbase + .3 })

  // Cab pillars and glass are separate fitted surfaces. Opaque reflective
  // glazing avoids transparent sorting artifacts in the instanced traffic.
  cabinRanges.push(range(b, () => {
    round({ x: 0, y: roof - .035, z: (roofFront + roofRear) / 2, w: roofW * 2 + .09, h: .105, d: roofFront - roofRear + .1, r: .045 }, roofColor)
    for (const side of [-1, 1]) {
      rod(b, v(side * cabW, belt, cabFront), v(side * roofW, roof - .055, roofFront), .065, roofColor, metal)
      rod(b, v(side * cabW, belt, cabRear), v(side * roofW, roof - .055, roofRear), utility ? .11 : .09, roofColor, metal)
    }
  }, roofColor))
  const front = [v(-cabW + .025, belt + .025, cabFront), v(cabW - .025, belt + .025, cabFront), v(roofW - .035, roof - .072, roofFront), v(-roofW + .035, roof - .072, roofFront)]
  panel(b, front, '#10171b', rubber)
  panel(b, front.map(p => v(p.x, p.y + .004, p.z + .008)), '#ffffff', glass, .075)
  const rear = [v(cabW - .02, belt + .04, cabRear), v(-cabW + .02, belt + .04, cabRear), v(-roofW + .035, roof - .08, roofRear), v(roofW - .035, roof - .08, roofRear)]
  if (!van && !truck && !pickup) {
    panel(b, rear, '#111a20', rubber)
    panel(b, rear.map(p => v(p.x, p.y + .004, p.z - .008)), '#ffffff', glass, .1)
  } else cabinRanges.push(range(b, () => panel(b, rear, roofColor, metal), roofColor))

  for (const side of [-1, 1]) {
    const sidePanel = (frontZ, rearZ, topFront, topRear, color, tile) => {
      const points = [v(side * (cabW + .006), belt + .055, rearZ), v(side * (cabW + .006), belt + .055, frontZ), v(side * (roofW + .015), roof - .085, topFront), v(side * (roofW + .015), roof - .085, topRear)]
      panel(b, side > 0 ? points : points.toReversed(), color, tile)
    }
    if (van || truck || pickup) {
      const split = cabFront - Math.min(1.32, S.cabin.length - .12)
      sidePanel(cabFront - .08, split, roofFront - .045, Math.max(roofRear + .045, split + .02), '#ffffff', glass)
      if (van) cabinRanges.push(range(b, () => sidePanel(split - .06, cabRear + .06, split - .06, roofRear + .05, bodyColor, metal), bodyColor))
    } else if (bus) {
      const count = 7
      for (let i = 0; i < count; i++) {
        const f = cabFront - .08 - (cabFront - cabRear - .16) * i / count, r = cabFront - .08 - (cabFront - cabRear - .16) * (i + 1) / count
        sidePanel(f, r + .06, Math.min(roofFront - .025, f - .025), Math.max(roofRear + .025, r + .06), '#ffffff', glass)
      }
    } else {
      const split = THREE.MathUtils.clamp(cabFront - (sport ? 1.15 : .97), roofRear + .15, roofFront - .15)
      sidePanel(cabFront - .07, split + .035, roofFront - .05, split + .035, '#ffffff', glass)
      sidePanel(split - .035, cabRear + .09, split - .035, roofRear + .04, '#ffffff', glass)
      rod(b, v(side * (cabW + .012), belt + .03, split), v(side * (roofW + .025), roof - .075, split), .067, '#171e22', rubber)
    }
    rod(b, v(side * (cabW + .018), belt + .015, cabRear + .02), v(side * (cabW + .018), belt + .015, cabFront - .02), .026, '#a6adb0', chrome)
    if (detail) {
      // Door shut lines, recessed handles, mirror stems and housings remain
      // dimensional at walking distance and disappear in the coarse mesh.
      const doors = sport || pickup || truck ? [cabFront - .95] : [cabFront - .82, cabRear + .48]
      for (const z of doors) {
        box({ x: side * width * .495, y: belt - .08, z, w: .018, h: .026, d: .17 }, '#b3b9bd', chrome)
        box({ x: side * width * .496, y: belt - .3, z: z - .2, w: .007, h: .42, d: .012 }, '#3b4246', rubber)
      }
      rod(b, v(side * cabW, belt + .12, cabFront - .16), v(side * (width / 2 + .09), belt + .17, cabFront - .2), .044, '#292e32', rubber)
      hullRanges.push(range(b, () => round({ x: side * (width / 2 + .11), y: belt + .18, z: cabFront - .24, w: .19, h: .13, d: .27, r: .045 }), bodyColor))
      box({ x: side * (width / 2 + .115), y: belt + .18, z: cabFront - .382, w: .135, h: .085, d: .012 }, '#ffffff', glass)
      rod(b, v(side * width * .49, .29, -S.wheelbase / 2 + wr + .09), v(side * width * .49, .29, S.wheelbase / 2 - wr - .09), .05, '#353d42', rubber)
    }
  }

  if (pickup) {
    const bedZ = -length / 2 + S.bed.length / 2 + .09, floor = belt - .14
    box({ x: 0, y: floor, z: bedZ, w: width * .86, h: .1, d: S.bed.length }, '#303638', rubber)
    hullRanges.push(range(b, () => {
      for (const side of [-1, 1]) round({ x: side * width * .466, y: belt + .12, z: bedZ, w: .12, h: .34, d: S.bed.length, r: .03 })
      round({ x: 0, y: belt + .12, z: -length / 2 + .07, w: width * .92, h: .34, d: .13, r: .03 })
    }, bodyColor))
  }
  if (truck) {
    const z = -length / 2 + S.boxBody.length / 2 + .06
    round({ x: 0, y: .85 + S.boxBody.height / 2, z, w: width * .97, h: S.boxBody.height, d: S.boxBody.length, r: .05 }, '#d2d1c9', metal)
    for (const side of [-1, 1]) box({ x: side * width * .49, y: .93, z, w: .04, h: .1, d: S.boxBody.length }, '#929a9e', chrome)
    if (detail) for (let i = 0; i < 9; i++) box({ x: 0, y: 1 + i * .25, z: -length / 2 - .007, w: width * .9, h: .016, d: .018 }, '#7c8387', chrome)
  }
  if (van && detail) {
    const z = (cabRear + cabFront - 1.3) / 2
    for (const side of [-1, 1]) box({ x: side * width * .464, y: belt + .15, z, w: .016, h: .02, d: 1.75 }, '#778083', chrome)
  }
  if ((wagon || bus) && detail) for (const side of [-1, 1]) rod(b, v(side * roofW * .88, roof + .055, roofRear + .18), v(side * roofW * .88, roof + .055, roofFront - .15), .045, '#4b5357', rubber)

  if (appearance.taxi) {
    const z = (roofFront + roofRear) / 2
    box({ y: roof + .055, z, w: .74, h: .065, d: .38 }, '#30383a', rubber)
    box({ y: roof + .18, z, w: .66, h: .23, d: .26 }, '#eeb528', metal)
    for (const side of [-1, 1]) {
      b.billboard({ y: roof + .18, z: z + side * .136, w: .61, h: .20, ry: side > 0 ? 0 : Math.PI, color: '#ffffff', rect: marking(1) })
      sideDecal(side, belt - .19, cabFront - 1.05, .41, .41, marking(0))
      if (detail) for (let i = 0; i < 10; i++) box({ x: side * width * .497, y: belt - .07, z: cabRear + .22 + i * .1, w: .018, h: .045, d: .058 }, '#29302d', rubber)
    }
  }
  if (appearance.rideshare && detail) {
    // Restrained service decal in the windshield corner and dark privacy glass.
    b.billboard({ x: -.48, y: belt + .12, z: cabFront - .075, w: .13, h: .085, color: '#bbbdb5', rect: white })
    for (const side of [-1, 1]) box({ x: side * width * .487, y: belt - .19, z: 0, w: .02, h: .025, d: S.wheelbase - .25 }, '#a4acae', chrome)
  }
  if (appearance.track) {
    const stripe = appearance.stripe || '#234439'
    // Narrow painted bands and a modest track wing distinguish the one rare
    // weekend car without adding a separate transparent decal material.
    for (const side of [-1, 1]) {
      b.plane({ x: side * .18, y: belt + .049, z: (length / 2 + cabFront) / 2 - .10, w: .12, d: Math.max(.12, length / 2 - cabFront - .28), color: stripe, rect: metal })
      sideDecal(side, belt - .14, cabFront - .94, .40, .34, marking(2))
      box({ x: side * width * .38, y: belt + .12, z: -length / 2 + .30, w: .05, h: .29, d: .13 }, '#26342f', rubber)
    }
    box({ y: belt + .29, z: -length / 2 + .29, w: width * .92, h: .055, d: .31 }, stripe, metal)
    box({ y: .245, z: length / 2 + .12, w: width * .93, h: .055, d: .24 }, '#25312d', rubber)
    if (detail) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) box({ x: side * width * .4, y: belt + .025, z: cabFront + .17 + i * .065, w: .16, h: .015, d: .025 }, '#24332c', rubber)
  }
  if (appearance.delivery) {
    const z = -length / 2 + S.boxBody.length / 2 + .06
    for (const side of [-1, 1]) {
      b.billboard({ x: side * width * .493, y: 2.1, z, w: 1.55, h: 1.05, ry: side * Math.PI / 2, color: '#ffffff', rect: marking(3) })
      box({ x: side * width * .492, y: 1.21, z, w: .016, h: .12, d: S.boxBody.length - .12 }, '#34534a', metal)
    }
  }

  // Recessed grille, bumper valance, plates and separate light housings.
  for (const side of [-1, 1]) {
    const z = side * (length / 2 + .048)
    round({ x: 0, y: belt - .27, z, w: width * .89, h: .21, d: .12, r: .045 }, '#30383e', rubber)
    if (detail) box({ x: 0, y: belt - .29, z: z + side * .066, w: .34, h: .14, d: .015 }, '#d8d5c8', white)
  }
  round({ x: 0, y: belt - .085, z: length / 2 + .06, w: width * .46, h: .2, d: .07, r: .028 }, '#a4aaad', chrome)
  box({ x: 0, y: belt - .085, z: length / 2 + .102, w: width * .415, h: .14, d: .012 })
  if (detail) for (let i = -2; i <= 2; i++) box({ x: i * width * .075, y: belt - .085, z: length / 2 + .115, w: .018, h: .13, d: .012 }, '#939a9f', chrome)
  for (const side of [-1, 1]) {
    const x = side * width * .34
    round({ x, y: belt - .055, z: length / 2 + .025, w: width * .23, h: .15, d: .115, r: .037 }, '#222c33', rubber)
    heads.push(range(b, () => box({ x, y: belt - .045, z: length / 2 + .089, w: width * .195, h: .062, d: .014 }, '#e3e8e8', atlas.uv('headlamp')), '#e3e8e8'))
    tails.push(range(b, () => round({ x, y: belt - .035, z: -length / 2 - .027, w: width * .24, h: .12, d: .065, r: .027 }, '#f94a38', atlas.uv('taillamp')), '#f94a38'))
  }
  let strobe = null
  if (S.strobe) strobe = range(b, () => round({ x: 0, y: roof + .1, z: (roofRear + roofFront) / 2, w: S.strobe.width, h: S.strobe.height, d: .24, r: .04 }, S.strobe.color, atlas.uv('beacon')), S.strobe.color)
  for (const side of [-1, 1]) for (const z of [-S.wheelbase / 2, S.wheelbase / 2]) wheels.push(wheel(b, { x: side * S.trackWidth / 2, z, radius: wr, width: S.wheelWidth, side, detail, atlas }))
  // No alpha blob is embedded in the body: physical tire contact and the
  // renderer's cheap fallback shadow own grounding without translucent faces.
  const geometry = b.build()
  return { geometry, paintRanges: { hull: hullRanges, cabin: cabinRanges }, wheels, lights: { head: heads, tail: tails }, strobe, roofHeight: roof,
    basePositions: new Float32Array(geometry.attributes.position.array), baseNormals: new Float32Array(geometry.attributes.normal.array) }
}
