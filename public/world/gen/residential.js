/** Original Brooklyn apartment kit, placed only on two existing generated lots. */
import * as THREE from 'three'
import { MeshBuilder } from './builder.js'
import { lotHalfExtents } from './blocks.js'

export const RESIDENTIAL_LOTS = Object.freeze({
  'downtown-3': { name: 'Court Street Apartments', floors: 8, facade: 'brick-brown', trim: '#a99f88', balcony: false },
  'downtown-1': { name: 'Atlantic House', floors: 16, facade: 'brick-grey', trim: '#b4b3a5', balcony: true, setback: 4 },
})

export function buildApartmentGeometry(lot, spec, atlas, lighting = {}, detail = true) {
  const b = new MeshBuilder(lighting, atlas), white = atlas.uv('white'), brick = atlas.uv('flat/' + spec.facade)
  const floorHeight = 3.05, floors = spec.floors - (spec.setback || 0), height = 3.6 + floors * floorHeight, trim = spec.trim, iron = '#34433f'
  const w = lot.w, d = lot.d
  const box = o => b.box({ color: '#ffffff', rect: white, ...o })
  // A solid inner core sits behind punched masonry facades; reveals and glass
  // terminate within it. All exterior detail fits the original collision lot.
  box({ y: height / 2, w: w - 2.7, h: height, d: d - 2.7, color: '#3c4947' })
  box({ y: .28, w, h: .5, d, color: '#787b71' })
  for (const [angle, span, depth] of [[0,w,d],[Math.PI,w,d],[Math.PI/2,d,w],[-Math.PI/2,d,w]]) {
    const cs = Math.cos(angle), sn = Math.sin(angle), face = depth / 2 - .85
    const p = (x = 0, y = 0, z = 0) => ({ x: x * cs - z * sn, y, z: x * sn + z * cs })
    const wall = o => box({ ...o, ...p(o.x, o.y, o.z), ry: angle })
    const pane = o => b.billboard({ color: '#ffffff', rect: white, ...o, ...p(o.x, o.y, o.z), ry: angle })
    const count = Math.max(3, Math.floor((span - 2.2) / 3.05)), pitch = (span - 1.8) / count, winW = Math.min(1.7, pitch - .9), winH = 1.76
    if (!detail) wall({ y: height / 2, z: face - .1, w: span - 1.3, h: height, d: .4, rect: brick })
    wall({ y: 1.92, z: face - .14, w: span - 1.3, h: 3.3, d: .34, color: spec.penthouse ? '#d1d0c4' : '#a39d89' })
    if (angle === 0 && !spec.penthouse) {
      // Shadowed vestibule and two glazed entrance leaves at pedestrian scale.
      pane({ y: 1.57, z: face + .04, w: 2.55, h: 2.5, color: '#253a35' })
      for (const side of [-1,1]) {
        pane({ x: side * .62, y: 1.62, z: face + .055, w: 1.12, h: 2.21, color: '#5a7271', rect: atlas.uv('window-reflection') })
        wall({ x: side * .13, y: 1.42, z: face + .11, w: .035, h: .45, d: .07, color: '#a8a28a' })
        wall({ x: side * 1.42, y: 1.68, z: face + .23, w: .25, h: 2.94, d: .48, color: trim })
      }
      wall({ y: 3.08, z: face + .30, w: 3.4, h: .2, d: 1.05, color: iron })
      wall({ x: 1.72, y: 1.44, z: face + .065, w: .2, h: .42, d: .075, color: '#5a6358' })
    }
    for (let floor = 0; floor < floors; floor++) {
      const y = 4.85 + floor * floorHeight, bottom = y - winH / 2, top = y + winH / 2
      if (detail) wall({ y: bottom - .65, z: face - .1, w: span - 1.3, h: floorHeight - winH, d: .4, rect: brick })
      for (let bay = 0; detail && bay <= count; bay++) {
        const x = (bay - count / 2) * pitch
        wall({ x, y, z: face - .1, w: pitch - winW, h: winH, d: .4, rect: brick })
      }
      for (let bay = 0; bay < count; bay++) {
        const x = (bay - (count - 1) / 2) * pitch, id = floor * 17 + bay * 5 + Math.round(angle * 10)
        const close = detail && floor < 7
        pane({ x, y, z: face + (detail ? -.34 : .105), w: winW, h: winH, color: id % 4 === 0 ? '#647975' : '#85918a', rect: atlas.uv('window-reflection') })
        if (close) {
          for (const side of [-1,1]) {
            wall({ x: x + side * (winW / 2 - .035), y, z: face - .16, w: .07, h: winH, d: .39, color: '#6b7469' })
            wall({ x, y: y + side * (winH / 2 - .035), z: face - .16, w: winW, h: .07, d: .39, color: '#6b7469' })
          }
          pane({ x, y, z: face - .27, w: winW - .12, h: .06, color: '#c2c1ae' })
          if (id % 5 === 0) for (const side of [-1,1]) pane({ x: x + side * winW * .33, y, z: face - .30, w: winW * .23, h: winH - .12, color: '#b2aa91' })
          if (id % 9 === 0) {
            wall({ x, y: bottom + .15, z: face + .12, w: .64, h: .4, d: .53, color: '#899187' })
            for (let slat = 0; slat < 4; slat++) pane({ x, y: bottom + .03 + slat * .08, z: face + .391, w: .56, h: .031, color: '#424e47' })
          }
          if (spec.balcony && angle === 0 && floor > 0 && bay % 3 === 1) {
            wall({ x, y: bottom - .15, z: face + .3, w: 2.2, h: .15, d: 1.0, color: trim })
            for (const side of [-1,1]) wall({ x: x + side * 1.04, y: bottom + .37, z: face + .3, w: .05, h: 1.03, d: 1.0, color: iron })
            wall({ x, y: bottom + .86, z: face + .79, w: 2.2, h: .055, d: .06, color: iron })
            for (let rail = 0; rail < 8; rail++) wall({ x: x + (rail - 3.5) * .28, y: bottom + .37, z: face + .79, w: .028, h: .98, d: .04, color: iron })
          }
        } else {
          pane({ x, y, z: face + (detail ? -.29 : .11), w: .065, h: winH, color: '#9b9f90' })
          pane({ x, y, z: face + (detail ? -.285 : .115), w: winW, h: .065, color: '#9b9f90' })
        }
        if (detail) wall({ x, y: bottom - .065, z: face + .035, w: winW + .18, h: .13, d: .35, color: trim })
        else pane({ x, y: bottom - .065, z: face + .12, w: winW + .18, h: .13, color: trim })
      }
      if (floor % 4 === 3) wall({ y: top + .36, z: face + .02, w: span - 1.25, h: .15, d: .45, color: trim })
    }
    wall({ y: height - .43, z: face - .1, w: span - 1.3, h: .86, d: .4, rect: brick })
    wall({ y: height + .10, z: face - .025, w: span - 1.2, h: .24, d: .65, color: trim })
  }
  box({ y: height + .02, w: w - 1.3, h: .10, d: d - 1.3, color: '#535c55', rect: atlas.uv('roof-tar') })
  box({ y: height + 1.4, z: -d * .18, w: w * .36, h: 2.7, d: d * .32, color: '#ffffff', rect: brick })
  box({ y: height + 2.78, z: -d * .18, w: w * .36 + .3, h: .18, d: d * .32 + .3, color: trim })
  if ((floors > 10 && !spec.setback) || spec.waterTower) {
    const x = w * .27, z = d * .18
    for (const side of [-1,1]) box({ x: x + side * .82, y: height + .82, z, w: .10, h: 1.64, d: 1.9, color: iron })
    b.cylinder({ x, y: height + 2.57, z, r: 1.25, h: 2.0, seg: detail ? 18 : 10, color: '#6d6450', rect: white })
    b.cone({ x, y: height + 3.87, z, r: 1.38, h: .64, seg: detail ? 18 : 10, color: '#6a7062', rect: white })
  }
  let geometry = b.build(), totalHeight = height
  if (spec.setback) {
    const upper = buildApartmentGeometry({ ...lot, w: lot.w - 7, d: lot.d - 6 }, { ...spec, floors: spec.setback - 1, setback: 0, balcony: false, penthouse: true, waterTower: true }, atlas, lighting, detail)
    const joined = new THREE.BufferGeometry(), offset = geometry.attributes.position.count
    for (const name of ['position','normal','color','uv']) {
      const a = geometry.attributes[name], b = upper.geometry.attributes[name]
      const values = new Float32Array(a.array.length + b.array.length)
      values.set(a.array); values.set(b.array, a.array.length)
      if (name === 'position') for (let i = a.array.length + 1; i < values.length; i += 3) values[i] += height + .08
      joined.setAttribute(name, new THREE.BufferAttribute(values, a.itemSize))
    }
    joined.setIndex([...geometry.index.array, ...Array.from(upper.geometry.index.array, i => i + offset)])
    geometry.dispose(); upper.geometry.dispose(); geometry = joined
    totalHeight = height + .08 + upper.height
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return { geometry, height: totalHeight, triangles: geometry.index.count / 3 }
}

export function buildResidentialLot(lot, atlas, materials, lighting) {
  const spec = RESIDENTIAL_LOTS[lot.id]
  if (!spec) return null
  const lod = new THREE.LOD(); lod.name = 'residential:' + lot.id
  const levels = [true, false].map(detail => buildApartmentGeometry(lot, spec, atlas, lighting, detail))
  for (const [i, level] of levels.entries()) {
    const mesh = new THREE.Mesh(level.geometry, materials.opaque)
    mesh.name = `${lod.name}:${i ? 'far' : 'near'}`; mesh.castShadow = mesh.receiveShadow = true
    lod.addLevel(mesh, i ? 90 : 0, .12)
  }
  lod.position.set(lot.x, 0, lot.z); lod.rotation.y = -(lot.ry || 0)
  lod.userData.residential = { name: spec.name, floors: spec.floors, lodTriangles: levels.map(l => l.triangles) }
  const extents = lotHalfExtents(lot)
  return { group: lod, triangles: levels[0].triangles, collider: { type: 'box', x: lot.x, z: lot.z, hx: extents.hx, hz: extents.hz, height: levels[0].height, tag: 'building' } }
}
