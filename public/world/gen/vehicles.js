/**
 * RAFFI WORLD — parametric vehicles.
 *
 * Each car is one merged, vertex-coloured mesh. Dimensions and paint still
 * come from vehicles.json, but bodywork, glass, lamps, wheels and blob shadow
 * share one atlas-backed material and therefore submit as one draw call.
 */

import * as THREE from 'three'
import { hexToRgb, makeRng } from '../engine/state.js'
import { attachHeroVehicle, updateHeroVehicle } from '../engine/hero-vehicle.js'
import { MeshBuilder } from './builder.js'
import { buildStreetVehicle } from './vehicle-kit.js'

function addBox(builder, options) {
  const start = builder.vertCount
  builder.box(options)
  return { start, end: builder.vertCount }
}

function addPlane(builder, options) {
  const start = builder.vertCount
  builder.plane(options)
  return { start, end: builder.vertCount }
}

function rangeWithShade(builder, range, baseHex) {
  const rgb = hexToRgb(baseHex)
  const channels = [rgb.r, rgb.g, rgb.b]
  let channel = 0
  if (channels[1] > channels[channel]) channel = 1
  if (channels[2] > channels[channel]) channel = 2
  const denom = Math.max(channels[channel], 0.0001)
  const shade = new Float32Array(range.end - range.start)
  for (let i = range.start; i < range.end; i++) {
    shade[i - range.start] = builder.col[i * 3 + channel] / denom
  }
  return { ...range, shade }
}

function paintRange(attribute, range, hex, strength = 1) {
  if (!range) return
  if (Array.isArray(range)) { range.forEach(part => paintRange(attribute, part, hex, strength)); return }
  const rgb = hexToRgb(hex)
  for (let i = range.start; i < range.end; i++) {
    const shade = range.shade ? range.shade[i - range.start] : 1
    attribute.setXYZ(i, rgb.r * shade * strength, rgb.g * shade * strength, rgb.b * shade * strength)
  }
}

function deformWheel(attribute, base, wheel, spin, steer, normals, baseNormals) {
  const { x: px, y: py, z: pz } = wheel.pivot
  const cosX = Math.cos(spin)
  const sinX = Math.sin(spin)
  const cosY = Math.cos(steer)
  const sinY = Math.sin(steer)

  for (let i = wheel.start; i < wheel.end; i++) {
    const o = i * 3
    let x = base[o] - px
    let y = base[o + 1] - py
    let z = base[o + 2] - pz

    const spunY = y * cosX - z * sinX
    const spunZ = y * sinX + z * cosX
    y = spunY
    z = spunZ

    const steeredX = x * cosY + z * sinY
    const steeredZ = -x * sinY + z * cosY
    x = steeredX
    z = steeredZ

    attribute.setXYZ(i, px + x, py + y, pz + z)
    if (normals && baseNormals) {
      const nx = baseNormals[o], ny = baseNormals[o + 1], nz = baseNormals[o + 2]
      const sy = ny * cosX - nz * sinX, sz = ny * sinX + nz * cosX
      normals.setXYZ(i, nx * cosY + sz * sinY, sy, -nx * sinY + sz * cosY)
    }
  }
}

function makeMicroVehicle(vehData, archetypeId, arch, seed, material, atlas, lighting) {
  const rng = makeRng('veh:' + archetypeId + ':' + seed)
  const S = arch.silhouette
  const shared = vehData.shared
  const white = atlas.uv('white')
  const builder = new MeshBuilder(lighting, atlas)
  const [paintA, paintB] = rng.pick(arch.colors)
  const deckY = S.deckHeight

  const deckRaw = addBox(builder, {
    x: 0, y: deckY, z: 0,
    w: S.width, h: 0.12, d: S.length,
    color: paintA, rect: atlas.uv('car-paint'),
  })
  const deck = rangeWithShade(builder, deckRaw, paintA)

  // Bright edge pieces make the tiny silhouette readable at the fixed camera.
  for (const z of [-S.length / 2 + 0.1, S.length / 2 - 0.1]) {
    addBox(builder, {
      x: 0, y: deckY + 0.08, z,
      w: S.width * 0.92, h: 0.08, d: 0.18,
      color: paintB, rect: atlas.uv('car-paint'), emissive: true,
    })
  }

  if (arch.kind === 'scooter') {
    const frontZ = S.wheelbase / 2
    addBox(builder, {
      x: 0, y: deckY + S.stemHeight / 2, z: frontZ - 0.04,
      w: 0.11, h: S.stemHeight, d: 0.11,
      color: paintB, rect: atlas.uv('car-paint'),
    })
    addBox(builder, {
      x: 0, y: deckY + S.stemHeight, z: frontZ - 0.04,
      w: S.handleWidth, h: 0.1, d: 0.1,
      color: paintA, rect: atlas.uv('car-paint'),
    })
  } else {
    for (const z of [-S.wheelbase * 0.36, S.wheelbase * 0.36]) {
      addBox(builder, {
        x: 0, y: deckY - 0.08, z,
        w: S.width * 0.84, h: 0.07, d: 0.09,
        color: '#9ba2aa', rect: white,
      })
    }
  }

  const wheels = []
  const wheelXs = arch.kind === 'scooter' ? [0] : [-S.width * 0.43, S.width * 0.43]
  for (const x of wheelXs) {
    for (const z of [-S.wheelbase / 2, S.wheelbase / 2]) {
      const start = builder.vertCount
      addBox(builder, {
        x, y: S.wheelRadius, z,
        w: arch.kind === 'scooter' ? S.width * 0.34 : 0.12,
        h: S.wheelRadius * 2,
        d: S.wheelRadius * 2,
        color: shared.wheel.color,
        rect: white,
      })
      wheels.push({
        start,
        end: builder.vertCount,
        front: z > 0,
        pivot: { x, y: S.wheelRadius, z },
      })
    }
  }

  addPlane(builder, {
    x: 0, y: 0.035, z: 0,
    w: Math.max(0.9, S.width * 1.35),
    d: S.length * 1.18,
    color: '#ffffff', rect: atlas.uv('blob'), emissive: true,
  })

  const geometry = builder.build()
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'vehicle:' + archetypeId
  mesh.frustumCulled = true
  mesh.userData = {
    archetype: archetypeId,
    kind: arch.kind,
    handling: arch.handling,
    length: S.length,
    width: S.width,
    paint: [paintA, paintB],
    paintRanges: { hull: deck, cabin: null },
    wheels,
    wheelRadius: S.wheelRadius,
    wheelSpin: 0,
    lights: { head: [], tail: [] },
    strobe: null,
    strobeOn: false,
    basePositions: new Float32Array(geometry.getAttribute('position').array),
    baseNormals: new Float32Array(geometry.getAttribute('normal').array),
  }
  return mesh
}

/** Builds one data-driven vehicle as a single draw-call mesh. */
export function makeVehicle(vehData, archetypeId, seed, material, atlas, lighting) {
  const arch = vehData.archetypes[archetypeId]
  if (!arch) return null
  if (arch.kind === 'skateboard' || arch.kind === 'scooter') {
    return makeMicroVehicle(vehData, archetypeId, arch, seed, material, atlas, lighting)
  }
  const rng = makeRng('veh:' + archetypeId + ':' + seed)
  const S = arch.silhouette
  const J = arch.jitter || {}
  // A model has one stable body shape so the pooled fleet can share geometry.
  // Paint still varies per spawn; consuming the old draws keeps that palette
  // selection and every later seeded choice stable.
  const shapeRng = makeRng('vehicle-shape:' + archetypeId)
  const jit = (v, amount) => {
    rng.next()
    return v * (1 + shapeRng.range(-(amount || 0), amount || 0))
  }
  const length = jit(S.length, J.length)
  const width = jit(S.width, J.width)
  const [paintA, paintB] = rng.pick(arch.colors)
  // Visual dimensions are modernized independently from the authored collision
  // footprint, handling and seeded paint choices.
  jit(S.cabin.height, J.cabinHeight)
  const args = { archetype: archetypeId, appearance: arch.appearance, silhouette: S, length, width, paint: [paintA, paintB], atlas, lighting }
  const near = buildStreetVehicle({ ...args, detail: true })
  const far = buildStreetVehicle({ ...args, detail: false })
  let farDisposed = false
  near.geometry.addEventListener('dispose', () => {
    if (!farDisposed) { farDisposed = true; far.geometry.dispose() }
  })
  const mesh = new THREE.Mesh(near.geometry, material)
  mesh.name = 'vehicle:' + archetypeId
  mesh.frustumCulled = true
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData = {
    archetype: archetypeId, handling: arch.handling, length, width,
    paint: [paintA, paintB], wheelRadius: S.wheelRadius, wheelSpin: 0,
    ...near, strobeOn: true,
    vehicleLods: [near, far], vehicleLodDistance: 36, vehicleLodHysteresis: 5,
  }
  delete mesh.userData.geometry
  attachHeroVehicle(mesh, atlas)
  return mesh
}

/** Per-frame cosmetics without splitting the vehicle into extra draw calls. */
export function animateVehicle(veh, dt, speed, steer, braking) {
  const ud = veh.userData
  const position = veh.geometry?.getAttribute('position')
  const color = veh.geometry?.getAttribute('color')
  const normal = veh.geometry?.getAttribute('normal')
  if (!position || !color) return

  ud.wheelSpin += (speed / (ud.wheelRadius || 0.34)) * dt
  ud.instancePose = [ud.wheelSpin, steer * 0.5, braking ? 1 : 0.35,
    ud.strobe && Math.sin(performance.now() * 0.001 * Math.PI * 2 * 5.5) <= 0 ? 0.02 : 1]
  if (updateHeroVehicle(veh, dt, speed, steer, braking)) return
  if (ud.actorBatched) {
    ud.strobeOn = ud.instancePose[3] === 1
    return
  }
  for (const wheel of ud.wheels) {
    deformWheel(position, ud.basePositions, wheel, ud.wheelSpin, wheel.front ? steer * 0.5 : 0, normal, ud.baseNormals)
  }
  position.needsUpdate = true
  if (normal) normal.needsUpdate = true

  const tailStrength = braking ? 1 : 0.35
  for (const range of ud.lights.tail) paintRange(color, range, '#ff3a2e', tailStrength)

  if (ud.strobe) {
    const on = Math.sin(performance.now() * 0.001 * Math.PI * 2 * 5.5) > 0
    if (on !== ud.strobeOn) {
      paintRange(color, ud.strobe, '#39e6ff', on ? 1 : 0.02)
      ud.strobeOn = on
    }
  }
  color.needsUpdate = true
}

/** Repaints the merged hull and cabin colour ranges in place. */
export function repaint(veh, vehData, seed) {
  const arch = vehData.archetypes[veh.userData.archetype]
  const rng = makeRng('repaint:' + seed)
  const [a, b] = rng.pick(arch.colors)
  const color = veh.geometry.getAttribute('color')
  paintRange(color, veh.userData.paintRanges.hull, a)
  paintRange(color, veh.userData.paintRanges.cabin, b)
  color.needsUpdate = true
  veh.userData.paint = [a, b]
  veh.userData.damage = 0
}

/** Garage finishes reuse the existing body ranges; glass and wheels keep their materials. */
export function paintVehicle(veh, body, roof) {
  const colors = veh.geometry.getAttribute('color')
  paintRange(colors, veh.userData.paintRanges.hull, body)
  paintRange(colors, veh.userData.paintRanges.cabin, roof)
  colors.needsUpdate = true
  veh.userData.paint = [body, roof]
}
