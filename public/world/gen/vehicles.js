/**
 * RAFFI WORLD — parametric vehicles.
 *
 * Each car is one merged, vertex-coloured mesh. Dimensions and paint still
 * come from vehicles.json, but bodywork, glass, lamps, wheels and blob shadow
 * share one atlas-backed material and therefore submit as one draw call.
 */

import * as THREE from 'three'
import { hexToRgb, makeRng } from '../engine/state.js'
import { MeshBuilder } from './builder.js'

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
  const rgb = hexToRgb(hex)
  for (let i = range.start; i < range.end; i++) {
    const shade = range.shade ? range.shade[i - range.start] : 1
    attribute.setXYZ(i, rgb.r * shade * strength, rgb.g * shade * strength, rgb.b * shade * strength)
  }
}

function deformWheel(attribute, base, wheel, spin, steer) {
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
    color: paintA, rect: white,
  })
  const deck = rangeWithShade(builder, deckRaw, paintA)

  // Bright edge pieces make the tiny silhouette readable at the fixed camera.
  for (const z of [-S.length / 2 + 0.1, S.length / 2 - 0.1]) {
    addBox(builder, {
      x: 0, y: deckY + 0.08, z,
      w: S.width * 0.92, h: 0.08, d: 0.18,
      color: paintB, rect: white, emissive: true,
    })
  }

  if (arch.kind === 'scooter') {
    const frontZ = S.wheelbase / 2
    addBox(builder, {
      x: 0, y: deckY + S.stemHeight / 2, z: frontZ - 0.04,
      w: 0.11, h: S.stemHeight, d: 0.11,
      color: paintB, rect: white,
    })
    addBox(builder, {
      x: 0, y: deckY + S.stemHeight, z: frontZ - 0.04,
      w: S.handleWidth, h: 0.1, d: 0.1,
      color: paintA, rect: white,
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
  const shared = vehData.shared
  const white = atlas.uv('white')
  const builder = new MeshBuilder(lighting, atlas)

  const jit = (v, amount) => v * (1 + rng.range(-(amount || 0), amount || 0))
  const length = jit(S.length, J.length)
  const width = jit(S.width, J.width)
  const [paintA, paintB] = rng.pick(arch.colors)
  const wr = S.wheelRadius
  const bodyY = wr + S.rideHeight
  const hullH = Math.max(S.hood.height, 0.5)
  const cabinLen = S.cabin.length
  const cabinH = jit(S.cabin.height, J.cabinHeight)
  const cabinW = width * (1 - S.cabin.insetSide * 2)
  const cabinZ = length / 2 - S.hood.length - cabinLen / 2

  const hullRaw = addBox(builder, {
    x: 0, y: bodyY + hullH / 2 - 0.1, z: 0,
    w: width, h: hullH, d: length,
    color: paintA, rect: white,
  })
  const hull = rangeWithShade(builder, hullRaw, paintA)

  const cabinRaw = addBox(builder, {
    x: 0, y: bodyY + hullH - 0.1 + cabinH / 2, z: cabinZ,
    w: cabinW, h: cabinH, d: cabinLen,
    color: paintB, rect: white,
  })
  const cabin = rangeWithShade(builder, cabinRaw, paintB)

  addBox(builder, {
    x: 0, y: bodyY + hullH - 0.1 + cabinH / 2 + cabinH * 0.12, z: cabinZ,
    w: cabinW + 0.02, h: cabinH * 0.52, d: cabinLen * 0.92,
    color: shared.glass.color, rect: atlas.uv('glasspane'),
  })

  if (S.boxBody) {
    addBox(builder, {
      x: 0,
      y: bodyY + S.boxBody.height / 2,
      z: -length / 2 + S.boxBody.length / 2 + 0.2,
      w: width * 1.02,
      h: S.boxBody.height,
      d: S.boxBody.length,
      color: '#e0dcd0',
      rect: white,
    })
  } else if (S.bed) {
    const wallH = S.bed.wallHeight
    const bedZ = -length / 2 + S.bed.length / 2 + 0.1
    for (const sx of [-1, 1]) {
      addBox(builder, {
        x: (sx * width) / 2 - sx * 0.06,
        y: bodyY + hullH - 0.1 + wallH / 2,
        z: bedZ,
        w: 0.12, h: wallH, d: S.bed.length,
        color: paintA, rect: white,
      })
    }
    addBox(builder, {
      x: 0,
      y: bodyY + hullH - 0.1 + wallH / 2,
      z: bedZ - S.bed.length / 2,
      w: width, h: wallH, d: 0.12,
      color: paintA, rect: white,
    })
  }

  for (const sz of [1, -1]) {
    addBox(builder, {
      x: 0,
      y: bodyY + S.bumper.height / 2 - 0.12,
      z: (sz * length) / 2,
      w: width * 0.98, h: S.bumper.height, d: S.bumper.depth,
      color: '#3a3e42', rect: white,
    })
  }

  if (S.grille) {
    const grilleY = bodyY + hullH * 0.45
    addBox(builder, {
      x: 0, y: grilleY, z: length / 2 + 0.085,
      w: S.grille.width, h: S.grille.height, d: 0.07,
      color: S.grille.color || '#c8ccce', rect: white,
    })
    addBox(builder, {
      x: 0, y: grilleY, z: length / 2 + 0.13,
      w: S.grille.width * 0.82, h: S.grille.height * 0.66, d: 0.025,
      color: '#20252b', rect: white,
    })
    for (const sx of [-1, 0, 1]) {
      addBox(builder, {
        x: sx * S.grille.width * 0.21,
        y: grilleY,
        z: length / 2 + 0.148,
        w: 0.025,
        h: S.grille.height * 0.58,
        d: 0.018,
        color: S.grille.color || '#c8ccce',
        rect: white,
      })
    }
  }

  const headRanges = []
  const tailRanges = []
  for (const sx of [-1, 1]) {
    headRanges.push(addBox(builder, {
      x: sx * width * 0.34,
      y: bodyY + hullH * 0.55,
      z: length / 2 + 0.02,
      w: 0.28, h: 0.16, d: 0.08,
      color: shared.lights.headColor, rect: white, emissive: true,
    }))
    tailRanges.push(addBox(builder, {
      x: sx * width * 0.34,
      y: bodyY + hullH * 0.55,
      z: -length / 2 - 0.02,
      w: 0.26, h: 0.14, d: 0.08,
      color: shared.lights.tailColor, rect: white, emissive: true,
    }))
  }

  let strobe = null
  if (S.strobe) {
    strobe = addBox(builder, {
      x: 0,
      y: bodyY + hullH - 0.1 + cabinH + 0.1,
      z: cabinZ,
      w: S.strobe.width, h: S.strobe.height, d: 0.3,
      color: S.strobe.color, rect: white, emissive: true,
    })
  }

  const wheels = []
  for (const sx of [-1, 1]) {
    for (const sz of [1, -1]) {
      const start = builder.vertCount
      const px = (sx * S.trackWidth) / 2
      const pz = (sz * S.wheelbase) / 2
      addBox(builder, {
        x: px, y: wr, z: pz,
        w: S.wheelWidth, h: wr * 2, d: wr * 2,
        color: shared.wheel.color, rect: white,
      })
      addBox(builder, {
        x: px + sx * (S.wheelWidth / 2 + 0.012), y: wr, z: pz,
        w: 0.03,
        h: wr * 2 * shared.wheel.hubFraction,
        d: wr * 2 * shared.wheel.hubFraction,
        color: shared.wheel.hubColor,
        rect: white,
      })
      wheels.push({
        start,
        end: builder.vertCount,
        front: sz > 0,
        pivot: { x: px, y: wr, z: pz },
      })
    }
  }

  addPlane(builder, {
    x: 0,
    y: 0.05,
    z: 0,
    w: width * shared.blobShadow.scale,
    d: length * shared.blobShadow.scale,
    color: '#ffffff',
    rect: atlas.uv('blob'),
    emissive: true,
  })

  const geometry = builder.build()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'vehicle:' + archetypeId
  mesh.frustumCulled = true

  mesh.userData = {
    archetype: archetypeId,
    handling: arch.handling,
    length,
    width,
    paint: [paintA, paintB],
    paintRanges: { hull, cabin },
    wheels,
    wheelRadius: wr,
    wheelSpin: 0,
    lights: { head: headRanges, tail: tailRanges },
    strobe,
    strobeOn: true,
    basePositions: new Float32Array(geometry.getAttribute('position').array),
  }
  return mesh
}

/** Per-frame cosmetics without splitting the vehicle into extra draw calls. */
export function animateVehicle(veh, dt, speed, steer, braking) {
  const ud = veh.userData
  const position = veh.geometry?.getAttribute('position')
  const color = veh.geometry?.getAttribute('color')
  if (!position || !color) return

  ud.wheelSpin += (speed / (ud.wheelRadius || 0.34)) * dt
  for (const wheel of ud.wheels) {
    deformWheel(position, ud.basePositions, wheel, ud.wheelSpin, wheel.front ? steer * 0.5 : 0)
  }
  position.needsUpdate = true

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
