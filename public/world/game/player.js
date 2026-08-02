/**
 * RAFFI WORLD — the player: walking, driving, and the swap between them.
 *
 * Movement is screen-relative and resolved through the camera's basis so the
 * stick always means the same thing regardless of which 90° snap the camera
 * is on. That is the whole reason `movementBasis()` exists.
 */

import * as THREE from 'three'
import { state, data, damp, clamp } from '../engine/state.js'
import { movementBasis } from '../engine/camera.js'
import { resolveCircle, clampToBounds, stepVehicle } from '../engine/physics.js'
import { makePed, animatePed } from '../gen/peds.js'
import { makeVehicle, animateVehicle } from '../gen/vehicles.js'

const WALK_SPEED = 2.6
const RUN_SPEED = 5.4
const PLAYER_RADIUS = 0.45

export const player = {
  group: null,
  ped: null,
  marker: null,
  vehicle: null,
  nearbyVehicle: null,
  /** Last ride exited — preferred for remount so exit offset never steals the scooter. */
  lastExited: null,
  animState: 'idle',
}

export function initPlayer(scene, materials, atlas) {
  const ped = makePed(
    data.npcs,
    'commuter',
    'player',
    materials.actor,
    atlas,
    data.blocks.vertexLighting,
    {
      includeShadow: false,
      colors: {
        shirt: '#28d7d7',
        pants: '#5e67c8',
        cap: '#ff5ca8',
      },
    }
  )
  // Bright palette + slight scale for open-ground readability, but depth testing
  // stays ON so buildings correctly hide the body (depthTest:false made alleys
  // look broken — person visible through walls).
  ped.scale.setScalar(1.18)
  ped.material = ped.material.clone()
  ped.material.depthTest = true
  ped.material.depthWrite = true
  ped.material.fog = true
  ped.renderOrder = 0
  const group = new THREE.Group()
  group.name = 'player'
  group.add(ped)

  group.position.set(state.player.x, 0, state.player.z)
  scene.add(group)

  // Ground ring is depth-tested with the ped. When a building covers you, track
  // position on the minimap instead of drawing an X-ray silhouette through roofs.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.82, 16),
    new THREE.MeshBasicMaterial({
      color: '#39E6FF',
      transparent: true,
      opacity: 0.72,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })
  )
  marker.name = 'player-locator'
  marker.rotation.x = -Math.PI / 2
  marker.renderOrder = 1
  marker.frustumCulled = false
  scene.add(marker)

  player.group = group
  player.ped = ped
  player.marker = marker
  syncPlayerVisual()
  return player
}

/** Spawns a drivable car near a position — used by the parking lots and missions. */
export function spawnVehicle(scene, materials, atlas, archetypeId, x, z, yaw, seed) {
  const archetype = data.vehicles.archetypes[archetypeId]
  if (!archetype) return null
  const mesh = makeVehicle(
    data.vehicles,
    archetypeId,
    seed,
    materials.actor,
    atlas,
    data.blocks.vertexLighting
  )
  if (!mesh) return null
  mesh.position.set(x, 0, z)
  mesh.rotation.y = yaw
  scene.add(mesh)
  const sil = archetype.silhouette || {}
  const length = sil.length || (archetype.kind === 'skateboard' || archetype.kind === 'scooter' ? 1.7 : 4.4)
  const width = sil.width || (archetype.kind === 'skateboard' || archetype.kind === 'scooter' ? 0.55 : 1.85)
  return {
    mesh,
    archetypeId,
    label: archetype.label || archetypeId,
    x, z, yaw,
    y: 0,
    speed: 0,
    lateral: 0,
    angularVel: 0,
    slip: 0,
    damage: 0,
    handling: archetype.handling,
    kind: archetype.kind || 'car',
    length,
    width,
    collisionRadius: archetype.collisionRadius || archetype.handling?.collisionRadius || 1.7,
    riderVisible: !!archetype.riderVisible,
    riderHeight: archetype.riderHeight || 0,
    cameraHeight: archetype.cameraHeight || null,
    mapRadius: archetype.mapRadius || null,
    controls: archetype.controls || null,
    mountLine: archetype.mountLine || null,
    enterRadius: archetype.enterRadius || data.vehicles.player.enterRadius,
    exitOffset: archetype.exitOffset || data.vehicles.player.exitOffset,
    occupied: false,
    remountAfter: 0,
  }
}

function canEnterVehicle(v, x, z) {
  if (!v || v.occupied) return false
  if (v.remountAfter && state.time < v.remountAfter) return false
  const enterRadius = v.enterRadius || data.vehicles.player.enterRadius
  const d = (v.x - x) ** 2 + (v.z - z) ** 2
  return d <= enterRadius * enterRadius
}

/** Nearest enterable car within the archetype's enter radius. */
export function findNearbyVehicle(vehicles, x, z) {
  // Prefer the ride just exited when still in range (garage is crowded).
  if (player.lastExited && canEnterVehicle(player.lastExited, x, z)) {
    return player.lastExited
  }
  const r = data.vehicles.player.enterRadius
  let best = null
  let bestD = Infinity
  for (const v of vehicles) {
    if (!canEnterVehicle(v, x, z)) continue
    const d = (v.x - x) ** 2 + (v.z - z) ** 2
    if (d < bestD) { bestD = d; best = v }
  }
  return best
}

export function enterVehicle(v) {
  if (!v) return false
  if (v.remountAfter && state.time < v.remountAfter) return false
  v.occupied = true
  v.stuckFrames = 0
  player.vehicle = v
  state.mode = 'vehicle'
  state.player.vehicle = v.archetypeId
  state.player.mountCameraHeight = v.cameraHeight
  state.player.mountMapRadius = v.mapRadius
  player.group.visible = v.riderVisible
  syncRiderVisual(v)
  syncMarker(v.x, v.y, v.z, v.kind === 'car' || !v.kind ? 1.7 : 1.08)
  return true
}

/**
 * Step off a ride. Works at any speed: motion is zeroed, then the player is
 * placed on the freest door / rear slot so they are not left inside the
 * vehicle footprint or shoved into a wall (the old left/right-only exit).
 */
export function exitVehicle(collisionWorld = null) {
  const v = player.vehicle
  if (!v) return false

  const micro = v.kind === 'skateboard' || v.kind === 'scooter'
  const halfW = (v.width || (micro ? 0.55 : 1.85)) * 0.5
  const halfL = (v.length || (micro ? 1.7 : 4.4)) * 0.5
  // Micro-rides stay tight so the garage board remount still finds the board.
  const sideOff = micro
    ? Math.max(v.exitOffset || 1.1, halfW + 0.55)
    : Math.max(v.exitOffset || data.vehicles.player.exitOffset, halfW + 0.95)
  const rearOff = halfL + (micro ? 0.7 : 1.15)
  const fwdOff = halfL + (micro ? 0.55 : 1.05)

  // Forward / right basis matches stepVehicle (yaw 0 → +Z).
  const fx = Math.sin(v.yaw)
  const fz = Math.cos(v.yaw)
  const rx = Math.cos(v.yaw)
  const rz = -Math.sin(v.yaw)

  // Rank: doors first when slow; when moving, prefer rear so the body is not
  // left "in front of" the car the player just leapt out of.
  const moving = Math.abs(v.speed) > 1.2
  const spots = [
    { x: v.x - rx * sideOff, z: v.z - rz * sideOff, rank: moving ? 2 : 0 },
    { x: v.x + rx * sideOff, z: v.z + rz * sideOff, rank: moving ? 2 : 0 },
    { x: v.x - rx * sideOff - fx * rearOff * 0.4, z: v.z - rz * sideOff - fz * rearOff * 0.4, rank: 1 },
    { x: v.x + rx * sideOff - fx * rearOff * 0.4, z: v.z + rz * sideOff - fz * rearOff * 0.4, rank: 1 },
    { x: v.x - fx * rearOff, z: v.z - fz * rearOff, rank: moving ? 0 : 2 },
    { x: v.x - rx * (sideOff + 0.7), z: v.z - rz * (sideOff + 0.7), rank: 3 },
    { x: v.x + rx * (sideOff + 0.7), z: v.z + rz * (sideOff + 0.7), rank: 3 },
    // Last resorts: further rear / slightly forward-side (not dead ahead).
    { x: v.x - fx * (rearOff + 0.8), z: v.z - fz * (rearOff + 0.8), rank: 4 },
    { x: v.x - rx * sideOff + fx * fwdOff * 0.25, z: v.z - rz * sideOff + fz * fwdOff * 0.25, rank: 5 },
    { x: v.x + rx * sideOff + fx * fwdOff * 0.25, z: v.z + rz * sideOff + fz * fwdOff * 0.25, rank: 5 },
  ]

  let exit = { x: spots[0].x, z: spots[0].z, y: v.y || 0 }
  let bestScore = Infinity

  for (const spot of spots) {
    let x = spot.x
    let z = spot.z
    let y = v.y || 0
    let correction = 0
    if (collisionWorld) {
      const resolved = resolveCircle(collisionWorld, x, z, PLAYER_RADIUS, 5)
      const bounded = clampToBounds(resolved.x, resolved.z, data.world.bounds, 6)
      correction = (bounded.x - spot.x) ** 2 + (bounded.z - spot.z) ** 2
      x = bounded.x
      z = bounded.z
      y = resolved.y
    }
    // Reject slots still inside the vehicle rectangle (front/back of hatchback).
    if (insideVehicleFootprint(x, z, v, halfW + 0.35, halfL + 0.35)) {
      correction += 40
    }
    const score = correction + spot.rank * 0.35
    if (score < bestScore) {
      bestScore = score
      exit = { x, z, y }
    }
  }

  // Keep the landing spot enterable so E remounts the same ride after a
  // moving exit, without dropping the player back inside the hull.
  const enterR = v.enterRadius || data.vehicles.player.enterRadius
  const maxRemountD = Math.max(sideOff, Math.min(enterR * 0.88, halfW + 1.35))
  let edx = exit.x - v.x
  let edz = exit.z - v.z
  let ed = Math.hypot(edx, edz)
  if (ed > maxRemountD && ed > 0.001) {
    exit.x = v.x + (edx / ed) * maxRemountD
    exit.z = v.z + (edz / ed) * maxRemountD
    if (collisionWorld) {
      const resolved = resolveCircle(collisionWorld, exit.x, exit.z, PLAYER_RADIUS, 4)
      const bounded = clampToBounds(resolved.x, resolved.z, data.world.bounds, 6)
      exit.x = bounded.x
      exit.z = bounded.z
      exit.y = resolved.y
    }
  }
  // Final footprint reject: nudge sideways if still inside the car rectangle.
  if (insideVehicleFootprint(exit.x, exit.z, v, halfW + 0.2, halfL + 0.2)) {
    exit.x = v.x - rx * maxRemountD
    exit.z = v.z - rz * maxRemountD
    if (collisionWorld) {
      const resolved = resolveCircle(collisionWorld, exit.x, exit.z, PLAYER_RADIUS, 4)
      const bounded = clampToBounds(resolved.x, resolved.z, data.world.bounds, 6)
      exit = { x: bounded.x, z: bounded.z, y: resolved.y }
    }
  }

  // Full stop — no residual car velocity in on-foot or the parked hull.
  v.speed = 0
  v.lateral = 0
  v.angularVel = 0
  v.stuckFrames = 0
  v.occupied = false
  // Brief remount lock so a held/double E does not re-enter the same frame.
  // Short enough that onboarding remounts (~100ms later) still pass.
  v.remountAfter = state.time + 0.05
  player.lastExited = v
  if (v.mesh) {
    v.mesh.position.set(v.x, v.y || 0, v.z)
    v.mesh.rotation.y = v.yaw
  }

  state.player.x = exit.x
  state.player.y = exit.y
  state.player.z = exit.z
  state.player.yaw = v.yaw
  state.player.vx = 0
  state.player.vz = 0
  state.player.speed = 0
  player.vehicle = null
  state.mode = 'foot'
  state.player.vehicle = null
  state.player.mountCameraHeight = null
  state.player.mountMapRadius = null
  player.group.visible = true
  syncPlayerVisual()
  return true
}

function insideVehicleFootprint(px, pz, v, halfW, halfL) {
  const dx = px - v.x
  const dz = pz - v.z
  const c = Math.cos(v.yaw)
  const s = Math.sin(v.yaw)
  // Local X = right, local Z = forward (matches fx/fz convention).
  const localRight = dx * c + dz * (-s)
  const localFwd = dx * s + dz * c
  return Math.abs(localRight) <= halfW && Math.abs(localFwd) <= halfL
}

/** Moves the on-foot player safely between world-space interaction points. */
export function teleportPlayer(x, z, yaw = state.player.yaw) {
  if (player.vehicle) exitVehicle()
  const p = state.player
  p.x = x
  p.z = z
  p.y = 0
  p.yaw = yaw
  p.vx = 0
  p.vz = 0
  p.speed = 0
  player.group.visible = true
  syncPlayerVisual()
}

/**
 * One player step.
 * @param input  the shared input struct
 * @param world  CollisionWorld
 */
export function updatePlayer(dt, input, world, beatPhase) {
  if (state.mode === 'vehicle' && player.vehicle) {
    updateDriving(dt, input, world)
    return
  }
  updateWalking(dt, input, world, beatPhase)
}

/** Keeps the visible actor aligned after a debug/audit teleport. */
export function syncPlayerVisual() {
  if (!player.group) return
  const p = state.player
  player.group.position.set(p.x, p.y, p.z)
  player.group.rotation.y = p.yaw
  syncMarker(p.x, p.y, p.z, 1)
}

function syncMarker(x, y, z, scale) {
  if (!player.marker) return
  player.marker.position.set(x, y + 0.045, z)
  player.marker.scale.setScalar(scale)
}

function updateWalking(dt, input, world, beatPhase) {
  const p = state.player
  const basis = movementBasis()

  const wantX = basis.rx * input.move.x + basis.fx * input.move.y
  const wantZ = basis.rz * input.move.x + basis.fz * input.move.y
  const mag = Math.hypot(wantX, wantZ)

  const target = input.run ? RUN_SPEED : WALK_SPEED
  const desiredX = mag > 0.001 ? (wantX / mag) * target * Math.min(1, mag) : 0
  const desiredZ = mag > 0.001 ? (wantZ / mag) * target * Math.min(1, mag) : 0

  p.vx = damp(p.vx, desiredX, 12, dt)
  p.vz = damp(p.vz, desiredZ, 12, dt)

  let nx = p.x + p.vx * dt
  let nz = p.z + p.vz * dt

  const res = resolveCircle(world, nx, nz, PLAYER_RADIUS, 2)
  const bounded = clampToBounds(res.x, res.z, data.world.bounds, 6)
  p.x = bounded.x
  p.z = bounded.z
  p.y = res.y

  p.speed = Math.hypot(p.vx, p.vz)
  if (mag > 0.01) p.yaw = Math.atan2(p.vx, p.vz)

  syncPlayerVisual()

  const st = p.speed < 0.2 ? 'idle' : p.speed > WALK_SPEED + 0.6 ? 'run' : 'walk'
  player.animState = st
  animatePed(player.ped, data.npcs, st, dt, p.speed, beatPhase)
}

function updateDriving(dt, input, world) {
  const v = player.vehicle
  const basis = movementBasis()
  const inputMag = Math.hypot(input.move.x, input.move.y)
  const microRide = v.kind === 'skateboard' || v.kind === 'scooter'

  // Cars use tank / arcade controls: A/D or stick X steers relative to the car,
  // W/S or GAS/BRAKE push along the nose. Point-to-go (reorient to the stick
  // vector) made desktop navigation feel like spinning a shopping cart under
  // a fixed iso camera — W fought the current heading instead of driving it.
  //
  // Micro-rides keep a soft screen-relative assist so kick/carve still tracks
  // the stick the way walking does.
  let steer = 0
  if (microRide && inputMag > 0.12) {
    const screenRight = basis.rx * input.move.x + basis.fx * input.move.y
    const screenFwd = basis.rz * input.move.x + basis.fz * input.move.y
    const desiredYaw = Math.atan2(screenRight, screenFwd)
    let diff = desiredYaw - v.yaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    // Blend aim-assist with pure lateral so small left/right nudges still carve.
    const aim = clamp(diff * 1.35, -1, 1)
    const lateral = clamp(input.move.x * 1.1, -1, 1)
    steer = clamp(aim * 0.72 + lateral * 0.45, -1, 1)
  } else {
    // Tank / arcade: only the lateral axis steers (A/D, stick X). Forward input
    // must never yaw the car — that was the main "can't navigate" complaint.
    steer = clamp(input.move.x, -1, 1)
  }

  // Dead-zone so resting stick/keyboard noise does not creep-turn.
  if (Math.abs(steer) < 0.08) steer = 0

  const ctl = {
    // Cars: throttle/brake come from W/S or GAS/BRAKE only (see updateInput).
    // Micro-rides may still push from stick magnitude when the kick button is up.
    throttle: input.throttle > 0.01
      ? input.throttle
      : (microRide && inputMag > 0.15 ? inputMag : 0),
    brake: input.brake,
    steer,
    handbrake: input.handbrake,
  }

  stepVehicle(v, v.handling, ctl, dt, world)

  const bounded = clampToBounds(v.x, v.z, data.world.bounds, 6)
  v.x = bounded.x
  v.z = bounded.z

  v.mesh.position.set(v.x, v.y, v.z)
  v.mesh.rotation.y = v.yaw
  animateVehicle(v.mesh, dt, v.speed, steer, ctl.brake > 0.05)

  const p = state.player
  p.x = v.x
  p.z = v.z
  p.y = v.y
  p.yaw = v.yaw
  p.speed = Math.abs(v.speed)
  p.vx = Math.sin(v.yaw) * v.speed
  p.vz = Math.cos(v.yaw) * v.speed

  if (v.riderVisible) {
    syncRiderVisual(v)
    animatePed(player.ped, data.npcs, 'idle', dt, Math.abs(v.speed) * 0.22, state.radio.beatPhase)
  }
  syncMarker(v.x, v.y, v.z, v.kind === 'car' || !v.kind ? 1.7 : 1.08)
}

function syncRiderVisual(v) {
  if (!v?.riderVisible || !player.group) return
  player.group.position.set(v.x, v.y + v.riderHeight, v.z)
  player.group.rotation.y = v.yaw
}

/** What the context button should say right now. */
export function contextAction(vehicles, extraActions = []) {
  if (state.mode === 'vehicle') {
    const microRide = player.vehicle?.kind === 'skateboard' || player.vehicle?.kind === 'scooter'
    return {
      label: 'EXIT',
      prompt: 'EXIT ' + (player.vehicle?.label || 'RIDE').toUpperCase(),
      kind: 'exit',
      key: microRide ? 'SPACE / E' : 'E',
    }
  }
  const px = state.player.x
  const pz = state.player.z
  let best = null
  let bestD = Infinity

  // Prefer the ride just exited when still in range (crib garage is crowded).
  const pool = player.lastExited && canEnterVehicle(player.lastExited, px, pz)
    ? [player.lastExited]
    : vehicles
  for (const v of pool) {
    if (!canEnterVehicle(v, px, pz)) continue
    const d = (v.x - px) ** 2 + (v.z - pz) ** 2
    if (d < bestD) {
      bestD = d
      best = {
        label: v.controls?.enter || (v.riderVisible ? 'RIDE' : 'ENTER'),
        prompt: (v.controls?.enter || (v.riderVisible ? 'RIDE' : 'ENTER')) + ' ' + v.label.toUpperCase(),
        kind: 'enter',
        target: v,
      }
    }
  }
  // If preferred last-exited is locked, fall back to any free ride.
  if (!best) {
    for (const v of vehicles) {
      if (!canEnterVehicle(v, px, pz)) continue
      const d = (v.x - px) ** 2 + (v.z - pz) ** 2
      if (d < bestD) {
        bestD = d
        best = {
          label: v.controls?.enter || (v.riderVisible ? 'RIDE' : 'ENTER'),
          prompt: (v.controls?.enter || (v.riderVisible ? 'RIDE' : 'ENTER')) + ' ' + v.label.toUpperCase(),
          kind: 'enter',
          target: v,
        }
      }
    }
  }

  for (const action of extraActions.filter(Boolean)) {
    const dx = action.x - px
    const dz = action.z - pz
    const d = dx * dx + dz * dz
    if (d <= action.radius * action.radius && d < bestD) {
      bestD = d
      best = action
    }
  }

  player.nearbyVehicle = best?.kind === 'enter' ? best.target : null
  if (best) return best
  return { label: '—', kind: 'none' }
}
