/**
 * RAFFI WORLD — pedestrian rigs.
 *
 * A pedestrian is one merged, vertex-coloured mesh. Small CPU-side vertex
 * transforms keep the box-rig walk cycle without submitting every limb as a
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

function addPlane(builder, options) {
  const start = builder.vertCount
  builder.plane(options)
  return { start, end: builder.vertCount }
}

function deformRange(attribute, base, range, pivot, rx = 0, yOffset = 0) {
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
  }
}

function deformRanges(attribute, base, ranges, pivot, rx = 0, yOffset = 0) {
  for (const range of ranges) deformRange(attribute, base, range, pivot, rx, yOffset)
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
    const bodyRange = addBox(builder, {
      x: 0, y: 0.34, z: 0, w: 0.5, h: 0.28, d: 0.9, color: fur, rect: white,
    })
    const head = addBox(builder, {
      x: 0, y: 0.46, z: 0.52, w: 0.28, h: 0.26, d: 0.26, color: fur, rect: white,
    })
    const tail = addBox(builder, {
      x: 0, y: 0.46, z: -0.6, w: 0.09, h: 0.09, d: 0.6, color: fur, rect: white,
    })
    const legs = []
    for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
      legs.push({
        ...addBox(builder, { x, y: 0.17, z, w: 0.1, h: 0.34, d: 0.1, color: fur, rect: white }),
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
      rig: 'quadruped',
      arch: archetypeId,
      phase: rng.range(0, Math.PI * 2),
      basePositions: new Float32Array(geometry.getAttribute('position').array),
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

  const hips = addBox(builder, {
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
  const torso = addBox(builder, {
    x: 0, y: torsoCentreY, z: 0,
    w: torsoW, h: torsoH, d: torsoD,
    color: shirt, rect: white,
  })
  const headCentreY = h - headR
  const head = addBox(builder, {
    x: 0, y: headCentreY, z: 0,
    w: headR * 2, h: headR * 2.2, d: headR * 2,
    color: skin, rect: white,
  })
  const capColor = colors.cap || (arch.accessory?.hardhat && rng.chance(arch.accessory.hardhat) ? '#e6c02e' : hair)
  const cap = addBox(builder, {
    x: 0, y: h - headR * 0.2, z: 0,
    w: headR * 2.1, h: headR * 0.7, d: headR * 2.1,
    color: capColor, rect: white,
  })

  const legs = []
  for (const sx of [-1, 1]) {
    const x = sx * torsoW * 0.22
    legs.push({
      ...addBox(builder, {
        x, y: legLen / 2, z: 0,
        w: body.leg.r * 2 * scale,
        h: legLen,
        d: body.leg.r * 2 * scale,
        color: pants,
        rect: white,
      }),
      pivot: { x, y: legLen, z: 0 },
    })
  }

  const arms = []
  const armLen = body.arm.length * scale
  for (const sx of [-1, 1]) {
    const x = sx * (torsoW / 2 + body.arm.r * scale)
    const pivotY = legLen + hipsH + torsoH * 0.92
    arms.push({
      ...addBox(builder, {
        x, y: pivotY - armLen / 2, z: 0,
        w: body.arm.r * 2 * scale,
        h: armLen,
        d: body.arm.r * 2 * scale,
        color: shirt,
        rect: white,
      }),
      pivot: { x, y: pivotY, z: 0 },
    })
  }

  if (arch.accessory?.bag && rng.chance(arch.accessory.bag)) {
    addBox(builder, {
      x: torsoW * 0.6,
      y: legLen + torsoH * 0.6,
      z: -0.06,
      w: 0.24 * scale,
      h: 0.3 * scale,
      d: 0.14 * scale,
      color: colors.bag || rng.pick(['#3a3e42', '#6e5136', '#2e4a6e']),
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
    rig: 'biped',
    arch: archetypeId,
    phase: rng.range(0, Math.PI * 2),
    height: h,
    basePositions: new Float32Array(geometry.getAttribute('position').array),
  }
  return mesh
}

/** Advances one merged rig. */
export function animatePed(ped, npcData, stateName, dt, speed, beatPhase = null) {
  const anim = npcData.animation
  const ud = ped.userData
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

  if (ud.rig === 'quadruped') {
    const { legs, tail, head } = ud.parts
    const amp = stateName === 'idle' ? 0.05 : 0.5
    const swings = [s, -s, -s, s]
    legs.forEach((leg, i) => deformRange(attribute, base, leg, leg.pivot, swings[i] * amp))
    deformRange(attribute, base, tail, tail.pivot, 0.4 + c * 0.15)
    deformRange(attribute, base, head, head.pivot, 0)
    attribute.needsUpdate = true
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

  deformRange(attribute, base, legs[0], legs[0].pivot, leftLeg)
  deformRange(attribute, base, legs[1], legs[1].pivot, rightLeg)
  deformRange(attribute, base, arms[0], arms[0].pivot, leftArm)
  deformRange(attribute, base, arms[1], arms[1].pivot, rightArm)
  deformRange(attribute, base, torso, torso.pivot, 0, bob)
  deformRanges(attribute, base, head.ranges, head.pivot, nod)
  attribute.needsUpdate = true
}
