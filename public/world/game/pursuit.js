/**
 * RAFFI WORLD — COMPLIANCE pursuit runtime.
 *
 * Compiles pursuer rosters from data/npcs.json, pools generated meshes, chases
 * the player, and runs the calendar-invite catch contract. Reply All Repaint
 * cancels pursuit immediately via compliance hooks.
 */

import * as THREE from 'three'
import { state, data, bus, clamp } from '../engine/state.js'
import { setCompliance, toast } from './hud.js'
import { queueDialogue } from './dialogue.js'
import { player } from './player.js'
import { makePed, animatePed } from '../gen/peds.js'
import { makeVehicle, animateVehicle } from '../gen/vehicles.js'
import { nearestRoad } from '../gen/roads.js'
import { resolveCircle, clampToBounds } from '../engine/physics.js'
import {
  compilePursuitRoster,
  complianceTuning,
  createContactTracker,
  stepContactTracker,
  stepNoContactDecay,
  approachAngles,
  spawnPointOnRing,
  distance2d,
  rosterSummary,
} from './pursuit-core.js'

const MAX_POOL = {
  drone: 4,
  foot: 2,
  vehicle: 6,
}

let deps = null
let tuning = null
let pool = { drone: [], foot: [], vehicle: [] }
let active = []
let contact = createContactTracker()
let decayState = { noContactSeconds: 0, decaySeconds: 0 }
let phase = 'idle' // idle | hunting | catching | fade-out | fade-in
let phaseT = 0
let currentTier = 0
let catchLineIndex = 0
let barkT = 0

export function initPursuit(options) {
  deps = options
  tuning = complianceTuning(data.npcs)
  contact = createContactTracker()
  decayState = { noContactSeconds: 0, decaySeconds: 0 }
  phase = 'idle'
  phaseT = 0
  currentTier = 0
  active = []
  buildPools()
  hideAll()
}

function buildPools() {
  pool = { drone: [], foot: [], vehicle: [] }
  const { scene, materials, atlas } = deps

  for (let i = 0; i < MAX_POOL.drone; i++) {
    const mesh = makeDroneMesh(materials)
    mesh.visible = false
    scene.add(mesh)
    pool.drone.push({ mesh, kind: 'drone', active: false, slot: null, x: 0, z: 0, y: 5.5, yaw: 0 })
  }
  for (let i = 0; i < MAX_POOL.foot; i++) {
    const mesh = makePed(data.npcs, 'suit', 'pursuer-foot-' + i, materials.actor, atlas, data.blocks.vertexLighting, {
      includeShadow: false,
      colors: { shirt: '#2A2E38', pants: '#1A1C22', cap: '#111318' },
    })
    mesh.visible = false
    scene.add(mesh)
    pool.foot.push({
      mesh, kind: 'foot', active: false, slot: null,
      x: 0, z: 0, y: 0, yaw: 0, anim: 'walk',
    })
  }
  for (let i = 0; i < MAX_POOL.vehicle; i++) {
    const mesh = makeVehicle(
      data.vehicles,
      'compliance-sedan',
      'pursuer-car-' + i,
      materials.actor,
      atlas,
      data.blocks.vertexLighting
    )
    mesh.visible = false
    scene.add(mesh)
    pool.vehicle.push({
      mesh, kind: 'vehicle', active: false, slot: null,
      x: 0, z: 0, y: 0, yaw: 0, speed: 0, lateral: 0, angularVel: 0,
    })
  }
}

function makeDroneMesh(_materials) {
  const g = new THREE.Group()
  g.name = 'pursuer-drone'
  // Simple generated geometry — no atlas dependency, one draw per drone.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.28, 0.9),
    new THREE.MeshBasicMaterial({ color: '#FFB03A', toneMapped: false, fog: true })
  )
  const blink = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.12, 0.25),
    new THREE.MeshBasicMaterial({ color: '#FFE347', toneMapped: false, fog: false })
  )
  blink.position.y = 0.22
  g.add(body)
  g.add(blink)
  g.userData.blink = blink
  return g
}

function hideAll() {
  for (const list of Object.values(pool)) {
    for (const actor of list) {
      actor.active = false
      actor.slot = null
      if (actor.mesh) actor.mesh.visible = false
    }
  }
  active = []
}

export function cancelPursuit(reason = 'cancel') {
  hideAll()
  contact = createContactTracker()
  decayState = { noContactSeconds: 0, decaySeconds: 0 }
  phase = 'idle'
  phaseT = 0
  currentTier = 0
  bus.emit('pursuit', { type: 'cancel', reason })
}

export function onComplianceCleared() {
  // Repaint / clear must cancel pursuit and any partial catch timer.
  cancelPursuit('repaint')
}

export function onComplianceTierChange(next) {
  if (phase === 'catching' || phase === 'fade-out' || phase === 'fade-in') return
  syncRosterToTier(next)
}

function syncRosterToTier(tier) {
  const t = Math.max(0, Math.floor(Number(tier) || 0))
  currentTier = t
  if (t <= 0) {
    hideAll()
    contact = createContactTracker()
    return
  }

  const roster = compilePursuitRoster(data.npcs, t)
  hideAll()
  active = []
  const angles = approachAngles(roster.length, state.player.yaw || 0)
  const span = tuning.spawnDistance

  roster.forEach((slot, index) => {
    const actor = takeFromPool(slot.kind)
    if (!actor) return
    const angle = angles[index] ?? (index * 1.7)
    const dist = span.min + (span.max - span.min) * (0.35 + (index % 3) * 0.2)
    const raw = spawnPointOnRing(state.player.x, state.player.z, angle, dist)
    const placed = placeSpawnAwayFromPlayer(raw.x, raw.z, raw.yaw, span.min * 0.85)
    actor.active = true
    actor.slot = slot
    actor.x = placed.x
    actor.z = placed.z
    actor.y = slot.kind === 'drone' ? (slot.hoverY || 5.5) : 0
    actor.yaw = placed.yaw
    actor.speed = 0
    actor.mesh.visible = true
    syncActorMesh(actor)
    active.push(actor)
  })

  contact = createContactTracker()
  barkT = 1.2
}

function takeFromPool(kind) {
  const list = pool[kind] || []
  return list.find((a) => !a.active) || null
}

function placeSpawnAwayFromPlayer(x, z, yaw, minPlayerDist) {
  const graph = deps.graph
  const px = state.player.x
  const pz = state.player.z
  const minD = Number.isFinite(minPlayerDist) ? minPlayerDist : 40

  // Prefer arterial nodes in the spawn-distance band so pursuers never appear
  // on top of the player after a road snap.
  if (graph?.nodes?.size) {
    let best = null
    let bestScore = Infinity
    for (const node of graph.nodes.values()) {
      const toPlayer = Math.hypot(node.x - px, node.z - pz)
      if (toPlayer < minD) continue
      const toTarget = Math.hypot(node.x - x, node.z - z)
      const score = toTarget + Math.abs(toPlayer - minD) * 0.15
      if (score < bestScore) {
        bestScore = score
        best = node
      }
    }
    if (best) {
      x = best.x
      z = best.z
    } else {
      // Fallback: keep the ring point if every node is too close.
      const ring = spawnPointOnRing(px, pz, yaw, minD + 10)
      x = ring.x
      z = ring.z
    }
  }

  if (deps.collision) {
    const res = resolveCircle(deps.collision, x, z, 1.2, 4)
    x = res.x
    z = res.z
  }
  // Final push if still too close after collision resolve.
  let toPlayer = Math.hypot(x - px, z - pz)
  if (toPlayer < minD && toPlayer > 0.001) {
    const s = (minD + 5) / toPlayer
    x = px + (x - px) * s
    z = pz + (z - pz) * s
  }
  const bounded = clampToBounds(x, z, data.world.bounds, 8)
  return { x: bounded.x, z: bounded.z, yaw }
}

function syncActorMesh(actor) {
  if (!actor.mesh) return
  actor.mesh.visible = actor.active
  actor.mesh.position.set(actor.x, actor.y || 0, actor.z)
  actor.mesh.rotation.y = actor.yaw || 0
}

export function updatePursuit(dt) {
  if (!deps || !tuning) return
  const tier = state.compliance.tier

  if (phase === 'fade-out' || phase === 'fade-in' || phase === 'catching') {
    stepCatchSequence(dt)
    return
  }

  if (tier !== currentTier) {
    syncRosterToTier(tier)
  }

  if (tier <= 0 || active.length === 0) {
    decayState = stepNoContactDecay(decayState, {
      inContactWithAny: false,
      dt,
      decayRequiresNoContact: tuning.decayRequiresNoContact,
      decaySecondsPerTier: tuning.decaySecondsPerTier,
      tier,
    })
    return
  }

  const px = state.player.x
  const pz = state.player.z
  let anyContact = false
  let catchCandidate = null
  let minCatchDist = Infinity

  for (const actor of active) {
    if (!actor.active || !actor.slot) continue
    stepActor(actor, px, pz, dt)

    const dist = distance2d(actor.x, actor.z, px, pz)
    if (actor.slot.canCatch && actor.slot.interceptRadius > 0) {
      if (dist < minCatchDist) {
        minCatchDist = dist
        catchCandidate = actor
      }
      if (dist <= actor.slot.interceptRadius) anyContact = true
    }
  }

  // Contact hold uses the nearest catch-capable actor.
  if (catchCandidate) {
    contact = stepContactTracker(contact, {
      canCatch: true,
      distance: minCatchDist,
      interceptRadius: catchCandidate.slot.interceptRadius,
      dt,
      holdSeconds: tuning.caughtHoldSeconds,
    })
    if (contact.inContact) anyContact = true
  } else {
    contact = createContactTracker()
  }

  decayState = stepNoContactDecay(decayState, {
    inContactWithAny: anyContact,
    dt,
    decayRequiresNoContact: tuning.decayRequiresNoContact,
    decaySecondsPerTier: tuning.decaySecondsPerTier,
    tier,
  })
  if (decayState.decayed && decayState.tier !== tier) {
    state.compliance.tier = decayState.tier
    setCompliance(decayState.tier)
    syncRosterToTier(decayState.tier)
  }

  barkT -= dt
  if (barkT <= 0 && active[0]?.slot?.lines?.length) {
    const lines = active[0].slot.lines
    queueDialogue(lines[Math.floor(Math.random() * lines.length)], { duration: 2.4 })
    barkT = 8 + Math.random() * 6
  }

  if (contact.caught) {
    beginCatch()
  }
}

function stepActor(actor, px, pz, dt) {
  const slot = actor.slot
  const dx = px - actor.x
  const dz = pz - actor.z
  const dist = Math.hypot(dx, dz) || 0.001
  const desiredYaw = Math.atan2(dx, dz)

  if (slot.kind === 'drone') {
    // Follow-only: keep authored interceptRadius (0) and orbit above.
    const followDist = 10
    const tx = px - Math.sin(desiredYaw) * followDist
    const tz = pz - Math.cos(desiredYaw) * followDist
    const speed = slot.speed
    const mx = tx - actor.x
    const mz = tz - actor.z
    const md = Math.hypot(mx, mz) || 1
    const step = Math.min(speed * dt, md)
    actor.x += (mx / md) * step
    actor.z += (mz / md) * step
    actor.y = slot.hoverY || 5.5
    actor.yaw = desiredYaw
    if (actor.mesh.userData.blink) {
      actor.mesh.userData.blink.visible = Math.sin(state.time * 12) > 0
    }
    syncActorMesh(actor)
    return
  }

  if (slot.kind === 'foot') {
    const stopAt = Math.max(0.6, slot.interceptRadius * 0.35)
    if (dist > stopAt) {
      const step = Math.min(slot.speed * dt, dist - stopAt)
      actor.x += (dx / dist) * step
      actor.z += (dz / dist) * step
      if (deps.collision) {
        const res = resolveCircle(deps.collision, actor.x, actor.z, 0.45, 2)
        actor.x = res.x
        actor.z = res.z
      }
      actor.yaw = desiredYaw
      animatePed(actor.mesh, data.npcs, 'walk', dt, slot.speed, state.radio.beatPhase)
    } else {
      actor.yaw = desiredYaw
      animatePed(actor.mesh, data.npcs, 'idle', dt, 0, state.radio.beatPhase)
    }
    syncActorMesh(actor)
    return
  }

  // Vehicle: drive toward an approach offset (alongside / box angles).
  let targetX = px
  let targetZ = pz
  if (slot.behaviour === 'pull-alongside') {
    const side = 4.2
    targetX = px + Math.cos(state.player.yaw || 0) * side
    targetZ = pz - Math.sin(state.player.yaw || 0) * side
  } else if (slot.behaviour === 'box-in' || slot.behaviour === 'block-intersections') {
    // Honest multi-unit surround: each sedan holds a ring point around the player
    // and drives toward it — not fake intersection-blocking pathfinding.
    const idx = active.filter((a) => a.kind === 'vehicle').indexOf(actor)
    const ring = approachAngles(Math.max(1, active.filter((a) => a.kind === 'vehicle').length))
    const ang = ring[Math.max(0, idx)] || 0
    const hold = slot.behaviour === 'block-intersections' ? 14 : 11
    targetX = px + Math.sin(ang) * hold
    targetZ = pz + Math.cos(ang) * hold
  }

  const tdx = targetX - actor.x
  const tdz = targetZ - actor.z
  const td = Math.hypot(tdx, tdz) || 0.001
  const wantYaw = Math.atan2(tdx, tdz)
  let dyaw = wantYaw - actor.yaw
  while (dyaw > Math.PI) dyaw -= Math.PI * 2
  while (dyaw < -Math.PI) dyaw += Math.PI * 2
  actor.yaw += clamp(dyaw, -2.2 * dt, 2.2 * dt)

  const speed = slot.speed * (0.55 + 0.45 * Math.max(0, 1 - Math.abs(dyaw)))
  actor.speed = speed
  actor.x += Math.sin(actor.yaw) * speed * dt
  actor.z += Math.cos(actor.yaw) * speed * dt
  if (deps.collision) {
    const res = resolveCircle(deps.collision, actor.x, actor.z, 1.6, 2)
    actor.x = res.x
    actor.z = res.z
  }
  const bounded = clampToBounds(actor.x, actor.z, data.world.bounds, 6)
  actor.x = bounded.x
  actor.z = bounded.z
  animateVehicle(actor.mesh, dt, actor.speed, dyaw, false)
  syncActorMesh(actor)
}

function beginCatch() {
  phase = 'catching'
  phaseT = 0
  // Freeze player motion without destroying mission / vehicle ownership.
  if (player.vehicle) {
    player.vehicle.speed = 0
    player.vehicle.lateral = 0
  }
  state.player.vx = 0
  state.player.vz = 0
  state.player.speed = 0
  const lines = tuning.catchLines
  const line = lines[catchLineIndex % lines.length]
  catchLineIndex += 1
  queueDialogue(line, { blocking: true, duration: 2.8 })
  toast('CALENDAR INVITE ACCEPTED', 3.2)
  bus.emit('pursuit', { type: 'caught', tier: currentTier })
}

function stepCatchSequence(dt) {
  phaseT += dt
  // Freeze motion while the invite plays.
  if (player.vehicle) {
    player.vehicle.speed = 0
    player.vehicle.lateral = 0
  }
  state.player.vx = 0
  state.player.vz = 0
  state.player.speed = 0

  if (phase === 'catching' && phaseT >= 1.6) {
    phase = 'fade-out'
    phaseT = 0
    showCatchFade(true, 'INVITE ACCEPTED · RECURRING')
  } else if (phase === 'fade-out' && phaseT >= 0.55) {
    // Clear COMPLIANCE, despawn pursuers, stay at collision-resolved location.
    state.compliance.tier = 0
    state.compliance.heat = 0
    setCompliance(0)
    hideAll()
    contact = createContactTracker()
    decayState = { noContactSeconds: 0, decaySeconds: 0 }
    currentTier = 0

    const resolved = deps.collision
      ? resolveCircle(deps.collision, state.player.x, state.player.z, 0.55, 4)
      : { x: state.player.x, z: state.player.z, y: 0 }
    const bounded = clampToBounds(resolved.x, resolved.z, data.world.bounds, 6)
    state.player.x = bounded.x
    state.player.z = bounded.z
    if (player.vehicle) {
      player.vehicle.x = bounded.x
      player.vehicle.z = bounded.z
      player.vehicle.speed = 0
      if (player.vehicle.mesh) {
        player.vehicle.mesh.position.set(bounded.x, 0, bounded.z)
      }
    } else if (player.group) {
      player.group.position.set(bounded.x, 0, bounded.z)
    }

    phase = 'fade-in'
    phaseT = 0
  } else if (phase === 'fade-in' && phaseT >= 0.55) {
    showCatchFade(false)
    phase = 'idle'
    phaseT = 0
    toast('WORKING GROUP DISMISSED', 2.4)
    bus.emit('pursuit', { type: 'released' })
  }
}

function showCatchFade(on, label) {
  const el = deps.catchEl
  if (!el) return
  if (on) {
    if (deps.catchLabel && label) deps.catchLabel.textContent = label
    el.classList.remove('hidden')
    requestAnimationFrame(() => el.classList.add('show'))
  } else {
    el.classList.remove('show')
    setTimeout(() => el.classList.add('hidden'), 280)
  }
}

export function pursuitSnapshot() {
  const roster = compilePursuitRoster(data.npcs, state.compliance.tier)
  return {
    phase,
    phaseT,
    tier: state.compliance.tier,
    currentTier,
    roster: rosterSummary(roster),
    active: active.filter((a) => a.active).map((a) => ({
      kind: a.kind,
      key: a.slot?.key || null,
      behaviour: a.slot?.behaviour || null,
      canCatch: !!a.slot?.canCatch,
      interceptRadius: a.slot?.interceptRadius ?? 0,
      distance: distance2d(a.x, a.z, state.player.x, state.player.z),
      x: a.x,
      z: a.z,
    })),
    contact: { ...contact },
    decay: { ...decayState },
    pool: {
      drone: pool.drone.filter((a) => a.active).length + '/' + pool.drone.length,
      foot: pool.foot.filter((a) => a.active).length + '/' + pool.foot.length,
      vehicle: pool.vehicle.filter((a) => a.active).length + '/' + pool.vehicle.length,
    },
    tuning: tuning ? {
      caughtHoldSeconds: tuning.caughtHoldSeconds,
      decaySecondsPerTier: tuning.decaySecondsPerTier,
      decayRequiresNoContact: tuning.decayRequiresNoContact,
      spawnDistance: { ...tuning.spawnDistance },
    } : null,
  }
}

/** True while catch freeze/fade owns the player. */
export function pursuitBlocksControl() {
  return phase === 'catching' || phase === 'fade-out' || phase === 'fade-in'
}

/** Debug/browser-smoke: pull active actors onto the player for contact tests. */
export function debugPullPursuersToPlayer() {
  for (const actor of active) {
    if (!actor.active) continue
    if (actor.slot?.canCatch) {
      actor.x = state.player.x
      actor.z = state.player.z
    } else {
      actor.x = state.player.x + 1.5
      actor.z = state.player.z + 1.5
    }
    if (actor.kind === 'drone') actor.y = actor.slot?.hoverY || 5.5
    syncActorMesh(actor)
  }
}
