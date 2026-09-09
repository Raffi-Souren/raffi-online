/**
 * RAFFI WORLD — pedestrian rigs.
 *
 * A pedestrian is one merged, vertex-coloured mesh. Small CPU-side vertex
 * transforms keep articulated, smoothly shaded bodies without submitting every limb as a
 * separate draw call or allocating one material per body part.
 */

import * as THREE from 'three'
import { makeRng } from '../engine/state.js'
import { MeshBuilder } from './builder.js'

function addBox(builder, options) {
  const start = builder.vertCount
  builder.box(options)
  return { start, end: builder.vertCount }
}

function addRound(builder, options) {
  const start = builder.vertCount
  builder.sphere({
    ...options, r: 0.5, sx: options.w, sy: options.h, sz: options.d,
    seg: options.seg || 8, rings: options.rings || 5,
  })
  return { start, end: builder.vertCount }
}

function addPlane(builder, options) {
  const start = builder.vertCount
  builder.plane(options)
  return { start, end: builder.vertCount }
}

function deformRange(attribute, base, range, pivot, rx = 0, yOffset = 0, normalAttribute = null, baseNormals = null) {
  const cos = Math.cos(rx)
  const sin = Math.sin(rx)
  for (let i = range.start; i < range.end; i++) {
    const o = i * 3
    const x = base[o] - pivot.x
    const y = base[o + 1] - pivot.y
    const z = base[o + 2] - pivot.z
    attribute.setXYZ(
      i,
      pivot.x + x,
      pivot.y + y * cos - z * sin + yOffset,
      pivot.z + y * sin + z * cos
    )
    if (normalAttribute && baseNormals) {
      const ny = baseNormals[o + 1], nz = baseNormals[o + 2]
      normalAttribute.setXYZ(i, baseNormals[o], ny * cos - nz * sin, ny * sin + nz * cos)
    }
  }
}

/** Builds one animated archetype as a single draw-call mesh. */
export function makePed(npcData, archetypeId, seed, material, atlas, lighting, options = {}) {
  const arch = npcData.archetypes[archetypeId] || npcData.archetypes.commuter
  const rng = makeRng('ped:' + archetypeId + ':' + seed)
  const body = npcData.body
  const scale = arch.scale || 1
  const pal = npcData.palettes
  const colors = options.colors || {}
  const white = atlas.uv('white')
  const builder = new MeshBuilder(lighting, atlas)

  const skin = colors.skin || rng.pick(pal.skin)
  const hair = colors.hair || rng.pick(pal.hair)
  const shirt = colors.shirt || rng.pick(pal[arch.palette?.shirt] || pal.shirtNeutral)
  const pants = colors.pants || rng.pick(pal[arch.palette?.pants] || pal.pants)

  if (arch.rig === 'quadruped') {
    const fur = colors.fur || rng.pick(arch.colors || ['#d9a441'])
    const bodyRange = addRound(builder, {
      x: 0, y: 0.34, z: 0, w: 0.5, h: 0.28, d: 0.9, color: fur, rect: white,
    })
    const head = addRound(builder, {
      x: 0, y: 0.46, z: 0.52, w: 0.28, h: 0.26, d: 0.26, color: fur, rect: white,
    })
    addRound(builder, { x: 0, y: 0.43, z: 0.68, w: 0.2, h: 0.15, d: 0.26, color: fur, rect: white, seg: 6, rings: 4 })
    for (const side of [-1, 1]) {
      addRound(builder, { x: side * 0.12, y: 0.57, z: 0.49, w: 0.1, h: 0.22, d: 0.13, color: fur, rect: white, seg: 6, rings: 4 })
      addRound(builder, { x: side * 0.08, y: 0.49, z: 0.645, w: 0.038, h: 0.04, d: 0.024, color: '#171a1c', rect: white, seg: 6, rings: 3 })
    }
    head.end = builder.vertCount
    const tail = addRound(builder, {
      x: 0, y: 0.46, z: -0.6, w: 0.09, h: 0.09, d: 0.6, color: fur, rect: white,
    })
    const legs = []
    for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
      legs.push({
        ...addRound(builder, { x, y: 0.17, z, w: 0.1, h: 0.34, d: 0.1, color: fur, rect: white, seg: 6, rings: 4 }),
        pivot: { x, y: 0.17, z },
      })
    }
    if (options.includeShadow !== false) {
      addPlane(builder, {
        x: 0, y: 0.025, z: 0, w: 0.65, d: 1.05,
        color: '#ffffff', rect: atlas.uv('blob'), emissive: true,
      })
    }

    const geometry = builder.build()
    geometry.boundingSphere.radius += 0.35
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'ped:' + archetypeId
    mesh.scale.setScalar(scale / 0.33)
    mesh.userData = {
      parts: {
        body: bodyRange,
        legs,
        tail: { ...tail, pivot: { x: 0, y: 0.46, z: -0.6 } },
        head: { ...head, pivot: { x: 0, y: 0.46, z: 0.52 } },
      },
      instancePalette: [fur, fur, fur, fur, fur, fur],
      instancePose: [0, 0, 0, 0],
      instanceBody: [0, 0, 1, 0],
      rig: 'quadruped',
      arch: archetypeId,
      phase: rng.range(0, Math.PI * 2),
      basePositions: new Float32Array(geometry.getAttribute('position').array),
    baseNormals: new Float32Array(geometry.getAttribute('normal').array),
    }
    return mesh
  }

  const h = body.height * scale
  const legLen = body.leg.length * scale
  const torsoH = body.torso.h * scale
  const torsoW = body.torso.w * scale
  const torsoD = body.torso.d * scale
  const hipsH = body.hips.h * scale
  const headR = body.headRadius * scale

  const hips = addRound(builder, {
    x: 0,
    y: legLen + hipsH * 0.5,
    z: 0,
    w: body.hips.w * scale,
    h: hipsH,
    d: body.hips.d * scale,
    color: pants,
    rect: white,
  })
  const torsoCentreY = legLen + hipsH + torsoH / 2
  const torso = addRound(builder, {
    x: 0, y: torsoCentreY, z: 0,
    w: torsoW, h: torsoH, d: torsoD,
    color: shirt, rect: white,
  })
  addRound(builder, { x: 0, y: legLen + hipsH + torsoH * 0.98, z: 0, w: torsoW * 0.39, h: torsoH * 0.25, d: torsoD * 0.67, color: skin, rect: white, seg: 8, rings: 4 })
  torso.end = builder.vertCount
  const headCentreY = h - headR
  const head = addRound(builder, {
    x: 0, y: headCentreY, z: 0,
    w: headR * 1.92, h: headR * 2.15, d: headR * 1.8,
    seg: 10, rings: 7,
    color: skin, rect: white,
  })
  // Nose, ears and eyes establish a readable face at the closer street camera.
  addRound(builder, { x: 0, y: headCentreY - headR * 0.07, z: headR * 0.88, w: headR * 0.36, h: headR * 0.45, d: headR * 0.35, color: skin, rect: white, seg: 6, rings: 4 })
  for (const side of [-1, 1]) {
    addRound(builder, { x: side * headR * 0.91, y: headCentreY, z: 0, w: headR * 0.27, h: headR * 0.58, d: headR * 0.36, color: skin, rect: white, seg: 6, rings: 4 })
    addRound(builder, { x: side * headR * 0.35, y: headCentreY + headR * 0.17, z: headR * 0.825, w: headR * 0.2, h: headR * 0.15, d: headR * 0.08, color: '#252a2d', rect: white, seg: 6, rings: 3 })
  }
  head.end = builder.vertCount
  const capColor = colors.cap || (arch.accessory?.hardhat && rng.chance(arch.accessory.hardhat) ? '#e6c02e' : hair)
  const cap = addRound(builder, {
    x: 0, y: h - headR * 0.2, z: 0,
    w: headR * 2.01, h: headR * 0.98, d: headR * 1.94,
    seg: 10, rings: 5,
    color: capColor, rect: white,
  })

  const legs = []
  for (const sx of [-1, 1]) {
    const x = sx * torsoW * 0.22
    const start = builder.vertCount
    addRound(builder, {
      x, y: legLen / 2 + 0.03 * scale, z: 0,
      w: body.leg.r * 2 * scale, h: legLen, d: body.leg.r * 2.12 * scale,
      color: pants, rect: white, seg: 8, rings: 5,
    })
    addRound(builder, {
      x, y: 0.065 * scale, z: 0.065 * scale,
      w: body.leg.r * 2.1 * scale, h: 0.13 * scale, d: 0.31 * scale,
      color: '#293038', rect: white, seg: 8, rings: 4,
    })
    legs.push({ start, end: builder.vertCount, pivot: { x, y: legLen, z: 0 } })
  }

  const arms = []
  const armLen = body.arm.length * scale
  for (const sx of [-1, 1]) {
    const x = sx * (torsoW / 2 + body.arm.r * scale * 0.7)
    const pivotY = legLen + hipsH + torsoH * 0.92
    const start = builder.vertCount
    addRound(builder, {
      x, y: pivotY - armLen * 0.41, z: 0,
      w: body.arm.r * 2.18 * scale, h: armLen * 0.94, d: body.arm.r * 2.1 * scale,
      color: shirt, rect: white, seg: 8, rings: 5,
    })
    addRound(builder, {
      x, y: pivotY - armLen * 0.96, z: 0,
      w: body.arm.r * 1.55 * scale, h: armLen * 0.26, d: body.arm.r * 1.7 * scale,
      color: skin, rect: white, seg: 6, rings: 4,
    })
    arms.push({ start, end: builder.vertCount, pivot: { x, y: pivotY, z: 0 } })
  }

  let bagColor = '#3a3e42'
  if (arch.accessory?.bag && rng.chance(arch.accessory.bag)) {
    bagColor = colors.bag || rng.pick(['#3a3e42', '#6e5136', '#2e4a6e'])
    addBox(builder, {
      x: torsoW * 0.6,
      y: legLen + torsoH * 0.6,
      z: -0.06,
      w: 0.24 * scale,
      h: 0.3 * scale,
      d: 0.14 * scale,
      color: bagColor,
      rect: white,
    })
  }

  if (options.includeShadow !== false) {
    addPlane(builder, {
      x: 0, y: 0.025, z: 0, w: 1.1, d: 1.1,
      color: '#ffffff', rect: atlas.uv('blob'), emissive: true,
    })
  }

  const geometry = builder.build()
  geometry.boundingSphere.radius += 0.35
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'ped:' + archetypeId
  mesh.userData = {
    parts: {
      legs,
      arms,
      torso: { ...torso, pivot: { x: 0, y: torsoCentreY, z: 0 } },
      head: {
        ranges: [head, cap],
        pivot: { x: 0, y: headCentreY, z: 0 },
      },
      hips,
      cap,
    },
    instancePalette: [skin, hair, shirt, pants, capColor, bagColor],
    instancePose: [0, 0, 0, 0],
    instanceBody: [0, 0, 0, 0],
    rig: 'biped',
    arch: archetypeId,
    phase: rng.range(0, Math.PI * 2),
    height: h,
    basePositions: new Float32Array(geometry.getAttribute('position').array),
    baseNormals: new Float32Array(geometry.getAttribute('normal').array),
  }
  return mesh
}

/** Advances one merged rig. */
export function animatePed(ped, npcData, stateName, dt, speed, beatPhase = null) {
  const anim = npcData.animation
  const ud = ped.userData
  ud.animationState = stateName
  ud.animationSpeed = speed
  const attribute = ped.geometry?.getAttribute('position')
  if (!ud.parts || !attribute) return

  let hz = anim.walkCycleHz
  if (stateName === 'run' || stateName === 'flee') hz = anim.runCycleHz
  else if (stateName === 'idle' || stateName === 'talk' || stateName === 'sit') hz = anim.idleSwayHz

  ud.phase += dt * hz * Math.PI * 2 * (stateName === 'idle' ? 1 : Math.max(0.4, speed / 1.4))

  if (beatPhase !== null && anim.beatQuantize?.enabled && (stateName === 'walk' || stateName === 'run')) {
    const target = beatPhase * Math.PI * 2 * (anim.beatQuantize.subdivision || 1)
    let diff = ((target - ud.phase + Math.PI) % (Math.PI * 2)) - Math.PI
    if (diff < -Math.PI) diff += Math.PI * 2
    ud.phase += diff * anim.beatQuantize.strength * dt * 3
  }

  const s = Math.sin(ud.phase)
  const c = Math.cos(ud.phase)
  const base = ud.basePositions
  const normalAttribute = ped.geometry.getAttribute('normal')
  const deform = (range, pivot, rx = 0, yOffset = 0) => deformRange(attribute, base, range, pivot, rx, yOffset, normalAttribute, ud.baseNormals)

  if (ud.rig === 'quadruped') {
    const { legs, tail, head } = ud.parts
    const amp = stateName === 'idle' ? 0.05 : 0.5
    const swings = [s, -s, -s, s]
    ud.instancePose = swings.map(value => value * amp)
    ud.instanceBody = [0.4 + c * 0.15, 0, 1, 0]
    if (ud.actorBatched || ud.presentationReplaced) return
    legs.forEach((leg, i) => deform(leg, leg.pivot, swings[i] * amp))
    deform(tail, tail.pivot, 0.4 + c * 0.15)
    deform(head, head.pivot, 0)
    attribute.needsUpdate = true
    if (normalAttribute) normalAttribute.needsUpdate = true
    return
  }

  const { legs, arms, torso, head } = ud.parts
  const legSwing = (anim.legSwingDeg * Math.PI) / 180
  const armSwing = (anim.armSwingDeg * Math.PI) / 180
  let leftLeg = 0
  let rightLeg = 0
  let leftArm = s * 0.06
  let rightArm = -s * 0.06
  let bob = 0
  let nod = 0

  if (stateName === 'talk') nod = Math.sin(ud.phase * anim.talkNodHz * 3) * 0.16
  if (!['idle', 'talk', 'sit'].includes(stateName)) {
    const mult = stateName === 'run' || stateName === 'flee' ? 1.35 : 1
    leftLeg = s * legSwing * mult
    rightLeg = -s * legSwing * mult
    leftArm = -s * armSwing * mult
    rightArm = s * armSwing * mult
    bob = Math.abs(c) * anim.bobAmplitude
  }

  ud.instancePose = [leftLeg, rightLeg, leftArm, rightArm]
  ud.instanceBody = [bob, nod, 0, 0]
  if (ud.actorBatched || ud.presentationReplaced) return
  deform(legs[0], legs[0].pivot, leftLeg)
  deform(legs[1], legs[1].pivot, rightLeg)
  deform(arms[0], arms[0].pivot, leftArm)
  deform(arms[1], arms[1].pivot, rightArm)
  deform(torso, torso.pivot, 0, bob)
  for (const range of head.ranges) deform(range, head.pivot, nod)
  attribute.needsUpdate = true
  if (normalAttribute) normalAttribute.needsUpdate = true
}
