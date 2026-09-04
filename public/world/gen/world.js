/**
 * RAFFI WORLD — scene assembly.
 *
 * Compiles the /data files into a scene graph and a collision world. One
 * builder set per district keeps the merged geometry small enough to cull, and
 * gives the streaming system something to unload later.
 */

import * as THREE from 'three'
import { makeRng } from '../engine/state.js'
import { makeBuilderSet, meshesFrom } from './builder.js'
import { buildRoadGraph, buildRoadGeometry } from './roads.js'
import { layoutLots, findOpenSpots } from './blocks.js'
import { buildDistrictBuildings } from './buildings.js'
import { emitProp, placeStreetFurniture, placeRoofProps } from './props.js'

/** Big flat water plane plus the harbour cut-ins. */
function buildWater(scene, world, materials) {
  const b = world.bounds
  const pad = 900
  const geo = new THREE.PlaneGeometry(
    b.maxX - b.minX + pad * 2,
    b.maxZ - b.minZ + pad * 2
  )
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geo, materials.water)
  mesh.position.set((b.minX + b.maxX) / 2, world.seaLevel, (b.minZ + b.maxZ) / 2)
  mesh.name = 'water'
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  scene.add(mesh)
  return mesh
}

/** Unreachable painted backdrop. Always stays a card. */
function buildFogCards(set, atlas, world) {
  for (const card of world.fogCards || []) {
    const rng = makeRng('card:' + card.id + ':' + card.seed)
    // ~half the silhouettes — backdrop should haze, not compete with city tris.
    const count = Math.max(8, Math.floor(card.width / 48))
    const facingZ = card.facing === 'south' || card.facing === 'north'
    for (let i = 0; i < count; i++) {
      const t = i / count
      const along = (t - 0.5) * card.width
      const h = card.silhouette === 'cranes'
        ? card.height * rng.range(0.4, 0.8)
        : card.height * rng.range(0.28, 1.0)
      const w = rng.range(18, 36)
      const x = facingZ ? card.at.x + along : card.at.x
      const z = facingZ ? card.at.z : card.at.z + along
      set.opaque.box({
        x, y: h / 2, z, w: facingZ ? w : 8, h, d: facingZ ? 8 : w,
        color: '#2a3348', rect: atlas.uv('white'),
        faces: facingZ ? ['south', 'north', 'up'] : ['east', 'west', 'up'],
      })
    }
  }
}

/** The named hero structures the block grammar is told to build around. */
export function buildLandmarks(set, atlas, propsData, world, districtId) {
  const colliders = []
  const white = atlas.uv('white')
  const groundProp = (type, x, z, ry, rng) => {
    const collider = emitProp(set, atlas, propsData, type, x, 0, z, ry, rng)
    if (collider) colliders.push(collider)
  }

  for (const lm of world.landmarks || []) {
    if (lm.district !== districtId) continue
    const rng = makeRng('landmark:' + lm.id)

    switch (lm.type) {
      case 'stadium': {
        // Ring of raked seating with floodlight pylons; interior pitch is a
        // separate interior scene.
        const seg = 22
        const rOuter = lm.radius
        const rInner = lm.radius * 0.62
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI * 2
          const a1 = ((i + 1) / seg) * Math.PI * 2
          const mid = (a0 + a1) / 2
          const w = ((rOuter - rInner) * 1.0)
          const len = (2 * Math.PI * ((rOuter + rInner) / 2)) / seg + 1.5
          const cx = lm.at.x + Math.cos(mid) * ((rOuter + rInner) / 2)
          const cz = lm.at.z + Math.sin(mid) * ((rOuter + rInner) / 2)
          set.opaque.box({
            x: cx, y: 11, z: cz, w, h: 22, d: len, ry: mid,
            color: '#8e8b82', rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
          })
          set.opaque.box({
            x: cx, y: 23.6, z: cz, w: w * 0.9, h: 3.2, d: len, ry: mid,
            color: '#6e6a62', rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
          })
          colliders.push({ type: 'box', x: cx, z: cz, hx: w / 2, hz: len / 2, ry: mid, tag: 'stadium' })
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.4
          groundProp('floodlight-pylon',
            lm.at.x + Math.cos(a) * (rOuter + 8), lm.at.z + Math.sin(a) * (rOuter + 8), a + Math.PI, rng)
        }
        break
      }

      case 'tower-hero': {
        // The tallest thing in Port Vantage; visible from every district and
        // the main navigation landmark alongside the stadium floodlights.
        const h = lm.height
        const w = 42
        const shells = 4
        let cw = w
        let cy = 0
        for (let i = 0; i < shells; i++) {
          const sh = h / shells
          set.opaque.box({
            x: lm.at.x, y: cy + sh / 2, z: lm.at.z, w: cw, h: sh, d: cw,
            color: '#ffffff', rect: atlas.uv('wall/glass-blue'), su: 1, sv: 1,
            faces: ['east', 'west', 'south', 'north'],
          })
          cy += sh
          cw *= 0.86
        }
        set.opaque.plane({ x: lm.at.x, y: h, z: lm.at.z, w: cw, d: cw, color: '#5a5e62', rect: white })
        emitProp(set, atlas, propsData, 'mast', lm.at.x, h, lm.at.z, 0, rng)
        set.emissive.billboard({
          x: lm.at.x, y: h * 0.55, z: lm.at.z + w / 2 + 0.2, w: 22, h: 5,
          color: '#ffffff', rect: atlas.uv('sign-lobby'), emissive: true,
        })
        colliders.push({ type: 'box', x: lm.at.x, z: lm.at.z, hx: w / 2, hz: w / 2, tag: 'tower' })
        break
      }

      case 'lobby': {
        const w = 76
        const d = 44
        set.opaque.box({
          x: lm.at.x, y: 7, z: lm.at.z, w, h: 14, d,
          color: '#ffffff', rect: atlas.uv('wall/glass-smoke'),
          faces: ['east', 'west', 'north'],
        })
        // Open south face so the lobby can be entered.
        for (const sx of [-1, 1]) {
          set.opaque.box({
            x: lm.at.x + sx * (w / 2 - 12), y: 7, z: lm.at.z + d / 2, w: 24, h: 14, d: 1.4,
            color: '#ffffff', rect: atlas.uv('wall/glass-smoke'),
            faces: ['east', 'west', 'south', 'north', 'up'],
          })
          colliders.push({ type: 'box', x: lm.at.x + sx * (w / 2 - 12), z: lm.at.z + d / 2, hx: 12, hz: 0.8, tag: 'lobby' })
        }
        set.opaque.plane({ x: lm.at.x, y: 14, z: lm.at.z, w, d, color: '#6e7276', rect: white })
        colliders.push({ type: 'box', x: lm.at.x, z: lm.at.z - d / 2, hx: w / 2, hz: 1, tag: 'lobby' })
        colliders.push({ type: 'box', x: lm.at.x - w / 2, z: lm.at.z, hx: 1, hz: d / 2, tag: 'lobby' })
        colliders.push({ type: 'box', x: lm.at.x + w / 2, z: lm.at.z, hx: 1, hz: d / 2, tag: 'lobby' })
        break
      }

      case 'storefront':
      case 'club': {
        const isClub = lm.type === 'club'
        const w = isClub ? 72 : 62
        const d = isClub ? 58 : 44
        set.opaque.box({
          x: lm.at.x, y: 6, z: lm.at.z, w, h: 12, d,
          color: '#ffffff', rect: atlas.uv(isClub ? 'wall/panel-black' : 'wall/brick-red'),
          faces: ['east', 'west', 'south', 'north', 'up'],
        })
        set.emissive.billboard({
          x: lm.at.x, y: 9.5, z: lm.at.z - d / 2 - 0.2, w: w * 0.6, h: 4,
          ry: Math.PI,
          color: '#ffffff', rect: atlas.uv(isClub ? 'sign-club' : 'sign-records'), emissive: true,
        })
        const frontZ = lm.at.z - d / 2
        const trim = isClub ? '#6f596b' : '#b5a081'
        set.opaque.box({
          x: lm.at.x, y: 12.1, z: lm.at.z, w: w + 0.8, h: 0.55, d: d + 0.8,
          color: trim, rect: white, faces: ['east', 'west', 'south', 'north', 'up'],
        })
        for (const side of [-1, 1]) {
          const x = lm.at.x + side * w * 0.26
          set.opaque.billboard({
            x, y: 3.8, z: frontZ - 0.12, w: w * 0.34, h: 5.5, ry: Math.PI,
            color: isClub ? '#344453' : '#ffffff', rect: atlas.uv(isClub ? 'glasspane' : 'record-window'),
          })
          set.opaque.box({
            x, y: 6.7, z: frontZ - 0.9, w: w * 0.36, h: 0.28, d: 1.8,
            color: isClub ? '#685268' : '#35565d', rect: white,
          })
        }
        set.opaque.billboard({
          x: lm.at.x, y: 3.2, z: frontZ - 0.14, w: 4.4, h: 6, ry: Math.PI,
          color: '#202e3a', rect: white,
        })
        set.emissive.billboard({
          x: lm.at.x, y: 6.7, z: frontZ - 0.15, w: 4.4, h: 0.3, ry: Math.PI,
          color: isClub ? '#eda5b6' : '#e6be7b', rect: white, emissive: true,
        })
        colliders.push({ type: 'box', x: lm.at.x, z: lm.at.z, hx: w / 2, hz: d / 2, tag: lm.type })
        if (isClub) {
          groundProp('neon-pole', lm.at.x - w / 2 - 3, lm.at.z - d / 2 + 6, 0, rng)
          groundProp('neon-pole', lm.at.x + w / 2 + 3, lm.at.z - d / 2 + 6, 0, rng)
        }
        break
      }

      case 'brownstone-hero': {
        // The player's apartment. Save point and wardrobe.
        set.opaque.box({
          x: lm.at.x, y: 9, z: lm.at.z, w: 26, h: 18, d: 22,
          color: '#ffffff', rect: atlas.uv('wall/brownstone-tan'), su: 1, sv: 0.62,
          faces: ['east', 'west', 'south', 'north'],
        })
        set.opaque.plane({ x: lm.at.x, y: 18, z: lm.at.z, w: 26, d: 22, color: '#6e5236', rect: white })
        for (const [y, width, depth, height] of [[17.8, 27.2, 23.2, 0.5], [18.3, 28, 24, 0.35]]) {
          set.opaque.box({ x: lm.at.x, y, z: lm.at.z, w: width, h: height, d: depth, color: '#9f896e', rect: white })
        }
        set.opaque.billboard({ x: lm.at.x, y: 3.4, z: lm.at.z + 11.08, w: 3.5, h: 4.4, color: '#304842', rect: white })
        set.emissive.billboard({ x: lm.at.x, y: 6, z: lm.at.z + 11.1, w: 3.5, h: 0.9, color: '#d6ae73', rect: atlas.uv('litwindow'), emissive: true })
        emitProp(set, atlas, propsData, 'water-tank', lm.at.x + 6, 18.5, lm.at.z - 4, 0, rng)
        for (let i = 0; i < 5; i++) {
          const h = 1.3 * (1 - i / 5)
          set.opaque.box({
            x: lm.at.x, y: h / 2, z: lm.at.z + 11 + i * 0.7, w: 5.2, h, d: 0.7,
            color: '#9a958c', rect: white, faces: ['up', 'south', 'east', 'west'],
          })
        }
        emitProp(set, atlas, propsData, 'stoop-rail', lm.at.x, 1.2, lm.at.z + 12, 0, rng)
        colliders.push({ type: 'box', x: lm.at.x, z: lm.at.z, hx: 13, hz: 11, tag: 'apartment' })
        break
      }

      case 'promenade': {
        const k = lm.keepout
        const w = k.maxX - k.minX
        const cx = (k.minX + k.maxX) / 2
        const cz = (k.minZ + k.maxZ) / 2
        set.opaque.plane({ x: cx, y: 0.3, z: cz, w, d: k.maxZ - k.minZ, color: '#8e8b82', rect: atlas.uv('sidewalk') })
        // Railing along the water edge.
        const posts = Math.floor(w / 4)
        for (let i = 0; i <= posts; i++) {
          const x = k.minX + (w * i) / posts
          set.opaque.box({ x, y: 0.85, z: k.minZ + 0.6, w: 0.16, h: 1.1, d: 0.16, color: '#3a3e42', rect: white })
        }
        set.opaque.box({ x: cx, y: 1.35, z: k.minZ + 0.6, w, h: 0.12, d: 0.12, color: '#3a3e42', rect: white })
        colliders.push({ type: 'box', x: cx, z: k.minZ + 0.4, hx: w / 2, hz: 0.6, tag: 'railing' })
        break
      }

      case 'suspension-bridge': {
        const span = lm.span
        const deckY = lm.deckY
        const startZ = lm.keepout.maxZ
        const endZ = lm.keepout.minZ
        const len = startZ - endZ
        set.opaque.box({
          x: lm.at.x, y: deckY, z: (startZ + endZ) / 2, w: 22, h: 1.2, d: len,
          color: '#8e8b82', rect: atlas.uv('road'), faces: ['up', 'down', 'east', 'west'],
        })
        for (const tz of [startZ - len * 0.25, startZ - len * 0.7]) {
          for (const sx of [-1, 1]) {
            set.opaque.box({
              x: lm.at.x + sx * 11, y: deckY + 22, z: tz, w: 3, h: 46, d: 3,
              color: '#7a4a3a', rect: white,
            })
          }
        }
        // Cable sag, approximated with straight segments — correct for the era.
        for (const sx of [-1, 1]) {
          const segs = 10
          for (let i = 0; i < segs; i++) {
            const t0 = i / segs
            const t1 = (i + 1) / segs
            const z0 = startZ - len * t0
            const z1 = startZ - len * t1
            const sag = (t) => 18 * Math.abs(Math.sin(t * Math.PI))
            const y0 = deckY + 40 - sag(t0)
            const y1 = deckY + 40 - sag(t1)
            set.opaque.box({
              x: lm.at.x + sx * 11, y: (y0 + y1) / 2, z: (z0 + z1) / 2,
              w: 0.4, h: Math.max(0.4, Math.abs(y1 - y0) + 0.4), d: Math.abs(z1 - z0),
              color: '#5a5e62', rect: white,
            })
          }
        }
        void span
        break
      }

      case 'gantry-cranes': {
        for (let i = 0; i < (lm.count || 3); i++) {
          const z = lm.keepout.minZ + ((lm.keepout.maxZ - lm.keepout.minZ) * (i + 0.5)) / (lm.count || 3)
          groundProp('crane-small', lm.at.x, z, -Math.PI / 2, rng)
        }
        break
      }

      case 'mobility-hub': {
        // The authored hub is a list of ordinary prop recipes. Adding or
        // rearranging a ride bay stays a data edit in world.json/props.json.
        for (const prop of lm.props || []) {
          const c = emitProp(
            set,
            atlas,
            propsData,
            prop.type,
            prop.at.x,
            prop.y || 0,
            prop.at.z,
            prop.yaw || 0,
            rng
          )
          if (c) colliders.push(c)
        }
        break
      }

      default:
        break
    }
  }

  return colliders
}

/** Builds one district into its own group. */
export function buildDistrict(district, ctx) {
  const { data, atlas, materials } = ctx
  const dcfg = data.blocks.districts[district.id]
  const set = makeBuilderSet(data.blocks.vertexLighting, atlas)
  const colliders = []

  // Ground pad for the district.
  const b = district.bounds
  set.opaque.plane({
    x: (b.minX + b.maxX) / 2,
    y: 0.005,
    z: (b.minZ + b.maxZ) / 2,
    w: b.maxX - b.minX,
    d: b.maxZ - b.minZ,
    color: dcfg.ground?.tint || '#ffffff',
    rect: atlas.uv(dcfg.ground?.tile || 'dirt'),
  })

  buildRoadGeometry(set, atlas, ctx.graph, data.world, district)

  const lots = layoutLots(district, data.blocks, ctx.graph, data.world)
  const built = buildDistrictBuildings(set, atlas, lots, data.blocks, {
    grade: ctx.grade,
    shopCount: atlas.shopCount,
  })
  colliders.push(...built.colliders)
  placeRoofProps(set, atlas, data.props, built.roofProps)

  colliders.push(...placeStreetFurniture(set, atlas, data.props, district, ctx.graph, data.blocks, data.world))
  colliders.push(...buildLandmarks(set, atlas, data.props, data.world, district.id))

  // Reply All Repaint shops.
  const rngShop = makeRng('repaint:' + district.id)
  for (const shop of data.world.repaintShops || []) {
    if (shop.district !== district.id) continue
    set.opaque.plane({ x: shop.at.x, y: 0.06, z: shop.at.z, w: 14, d: 14, color: '#4a4e52', rect: atlas.uv('road') })
    const sign = emitProp(set, atlas, data.props, 'repaint-sign', shop.at.x, 0, shop.at.z + 8, shop.yaw, rngShop)
    if (sign) colliders.push(sign)
  }

  // A little scatter so open ground is not empty (capped for perf).
  const scatterN = district.id === 'yards' ? 24 : district.id === 'bowl' ? 12 : 8
  const scatter = findOpenSpots(district, lots, ctx.graph, data.world, scatterN, 'scatter')
  const rngScatter = makeRng('scatter:' + district.id)
  for (const spot of scatter) {
    const name = rngScatter.weighted(dcfg.propWeights)
    if (!data.props.props[name]) continue
    // Skip heavy multi-part props in scatter (containers still ok in yards).
    if (name === 'crane-small' || name === 'bus-shelter' || name === 'bleacher') continue
    const c = emitProp(set, atlas, data.props, name, spot.x, 0, spot.z, rngScatter.range(0, 6.28), rngScatter)
    if (c) colliders.push(c)
  }

  const group = meshesFrom(set, materials, 'district:' + district.id)
  group.userData.district = district.id
  return { group, colliders, lots, triangles: set.triangleCount }
}

/** Builds the whole world. Returns groups, colliders and stats. */
export function buildWorld(ctx) {
  const { data, atlas, materials, scene } = ctx
  const graph = buildRoadGraph(data.world)
  ctx.graph = graph

  buildWater(scene, data.world, materials)

  const root = new THREE.Group()
  root.name = 'city'
  scene.add(root)

  const collision = []
  const districts = new Map()
  let triangles = 0

  for (const district of data.world.districts) {
    const out = buildDistrict(district, ctx)
    root.add(out.group)
    districts.set(district.id, out)
    collision.push(...out.colliders)
    triangles += out.triangles
  }

  // Backdrop last so it never fights the city for the depth buffer.
  const cardSet = makeBuilderSet(data.blocks.vertexLighting, atlas)
  buildFogCards(cardSet, atlas, data.world)
  root.add(meshesFrom(cardSet, materials, 'fogcards'))

  return { root, graph, districts, collision, triangles }
}
