/**
 * RAFFI WORLD — the player: walking, driving, and the swap between them.
 *
 * Movement is screen-relative and resolved through the camera's basis so the
 * stick always means the same thing regardless of which 90° snap the camera
 * is on. That is the whole reason `movementBasis()` exists.
 */

import * as THREE from 'three'
import { state, data, damp, clamp, bus } from '../engine/state.js'
import { movementBasis, getCameraMode } from '../engine/camera.js'
import { resolveCircle, clampToBounds, stepVehicle } from '../engine/physics.js'
import { makePed, animatePed } from '../gen/peds.js'
import { makeVehicle, animateVehicle } from '../gen/vehicles.js'

const WALK_SPEED = 3.4
const RUN_SPEED = 6.2
const PLAYER_RADIUS = 0.45

export const player = {
  group: null,
  ped: null,
  marker: null,
  vehicle: null,
  nearbyVehicle: null,
  animState: 'idle',
  /** Active board trick, if any: { name, t, duration, boost }. */
  trick: null,
  /**
   * Last committed turn direction (-1 | 0 | 1). Gives U-turns a stable spin:
   * at ~180° the shortest-arc sign is arbitrary, so we keep turning the way
   * we already were instead of flip-flopping ("haywire" taps).
   */
  steerBias: 0,
}

const KICKFLIP = {
  name: 'kickflip',
  duration: 0.58,
  hop: 0.95,
  boost: 3.8,
  minSpeed: 1.2,
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
  // Keep the player bright and readable in the open, while honoring scene
  // depth so walls and roofs correctly occlude the body.
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

  // The ground locator follows the same depth rules: the minimap remains the
  // navigation aid while the player is legitimately behind a building.
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
  }
}

/** Nearest enterable car within the archetype's enter radius. */
export function findNearbyVehicle(vehicles, x, z) {
  const r = data.vehicles.player.enterRadius
  let best = null
  let bestD = Infinity
  for (const v of vehicles) {
    if (v.occupied) continue
    const d = (v.x - x) ** 2 + (v.z - z) ** 2
    const enterRadius = v.enterRadius || r
    if (d < enterRadius * enterRadius && d < bestD) { bestD = d; best = v }
  }
  return best
}

export function enterVehicle(v) {
  if (!v) return false
  v.occupied = true
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
 * Start a skateboard kickflip if moving and not already tricking.
 * @returns {boolean} whether the trick began
 */
export function tryKickflip() {
  const v = player.vehicle
  if (!v || v.kind !== 'skateboard') return false
  if (player.trick) return false
  if (Math.abs(v.speed) < KICKFLIP.minSpeed) return false

  player.trick = {
    name: KICKFLIP.name,
    t: 0,
    duration: KICKFLIP.duration,
    hop: KICKFLIP.hop,
    boost: KICKFLIP.boost,
  }
  // Pop forward a bit mid-trick energy.
  v.speed = Math.sign(v.speed || 1) * Math.min(
    Math.abs(v.speed) + KICKFLIP.boost * 0.35,
    (v.handling?.topSpeed || 12) * 1.15
  )
  bus.emit('toast', 'KICKFLIP!')
  return true
}

export function isBoardTrickActive() {
  return !!player.trick
}

export function exitVehicle(collisionWorld = null) {
  const v = player.vehicle
  if (!v) return false
  if (player.trick) return false // finish the flip first
  const off = v.exitOffset || data.vehicles.player.exitOffset
  const sideX = Math.cos(v.yaw)
  const sideZ = -Math.sin(v.yaw)
  const candidates = [
    { x: v.x - sideX * off, z: v.z - sideZ * off },
    { x: v.x + sideX * off, z: v.z + sideZ * off },
  ]
  let exit = { ...candidates[0], y: v.y || 0 }

  // Prefer the authored side, but use the opposite door when a wall or world
  // edge would swallow the player. Vehicles are dynamic and intentionally not
  // part of the static collision hash, so testing both sides is sufficient.
  if (collisionWorld) {
    let bestCorrection = Infinity
    for (const candidate of candidates) {
      const resolved = resolveCircle(collisionWorld, candidate.x, candidate.z, PLAYER_RADIUS, 4)
      const bounded = clampToBounds(resolved.x, resolved.z, data.world.bounds, 6)
      const correction = (bounded.x - candidate.x) ** 2 + (bounded.z - candidate.z) ** 2
      if (correction < bestCorrection) {
        bestCorrection = correction
        exit = { x: bounded.x, z: bounded.z, y: resolved.y }
      }
    }
  }

  state.player.x = exit.x
  state.player.y = exit.y
  state.player.z = exit.z
  state.player.yaw = v.yaw
  state.player.vx = 0
  state.player.vz = 0
  state.player.speed = 0
  v.occupied = false
  v.speed = 0
  player.vehicle = null
  state.mode = 'foot'
  state.player.vehicle = null
  state.player.mountCameraHeight = null
  state.player.mountMapRadius = null
  player.group.visible = true
  syncPlayerVisual()
  return true
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
    updateDriving(dt, input, world, beatPhase)
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
  // Chase: body-relative (turns with you). Free/iso: camera screen axes.
  const basis = movementBasis()

  const wantX = basis.rx * input.move.x + basis.fx * input.move.y
  const wantZ = basis.rz * input.move.x + basis.fz * input.move.y
  const mag = Math.hypot(wantX, wantZ)

  const target = input.run ? RUN_SPEED : WALK_SPEED
  const desiredX = mag > 0.001 ? (wantX / mag) * target * Math.min(1, mag) : 0
  const desiredZ = mag > 0.001 ? (wantZ / mag) * target * Math.min(1, mag) : 0

  // Snappier accel/stop — the old damp rate felt like ice-skating.
  const blend = mag > 0.01 ? 18 : 14
  p.vx = damp(p.vx, desiredX, blend, dt)
  p.vz = damp(p.vz, desiredZ, blend, dt)

  let nx = p.x + p.vx * dt
  let nz = p.z + p.vz * dt

  const res = resolveCircle(world, nx, nz, PLAYER_RADIUS, 3)
  const bounded = clampToBounds(res.x, res.z, data.world.bounds, 6)
  p.x = bounded.x
  p.z = bounded.z
  p.y = res.y

  p.speed = Math.hypot(p.vx, p.vz)
  // Face movement; if almost stopped keep last facing.
  if (p.speed > 0.35) p.yaw = Math.atan2(p.vx, p.vz)

  syncPlayerVisual()

  const st = p.speed < 0.25 ? 'idle' : p.speed > WALK_SPEED + 0.5 ? 'run' : 'walk'
  player.animState = st
  animatePed(player.ped, data.npcs, st, dt, p.speed, beatPhase)
}

function updateDriving(dt, input, world, beatPhase = 0) {
  const v = player.vehicle
  const basis = movementBasis()
  const inputMag = Math.hypot(input.move.x, input.move.y)
  const microRide = v.kind === 'skateboard' || v.kind === 'scooter'

  // Steering is screen-relative in classic/free/birds: the pressed direction
  // is where the ride goes on screen — cars included, so Right never reads as
  // "left" when the nose points at the viewer. Chase 3D stays body-relative
  // (camera sits behind you, so nose-relative already matches the screen).
  const chaseCam = getCameraMode().id === 'chase'
  let steer = 0
  /** cos(nose vs stick) — 1 aligned, 0 perpendicular, -1 opposite. */
  let aimAlignment = 1
  // While braking to a stop (Down held, still rolling forward), aim only the
  // lateral axis — otherwise "brake" would read as "U-turn to face the viewer"
  // and the ride would swerve mid-stop.
  const brakingForward = input.brake > 0.05 && v.speed > 0.15
  const aimX = input.move.x
  const aimY = brakingForward ? 0 : input.move.y
  const aimMag = Math.hypot(aimX, aimY)
  if (!chaseCam && aimMag > 0.12) {
    const wantX = basis.rx * aimX + basis.fx * aimY
    const wantZ = basis.rz * aimX + basis.fz * aimY
    const desiredYaw = Math.atan2(wantX, wantZ)
    const reversing = v.speed < -0.15
    // Aim the direction of travel: the nose, or the tail while backing up —
    // so the ride always moves toward the pressed screen direction.
    const travelYaw = reversing ? v.yaw + Math.PI : v.yaw
    let diff = desiredYaw - travelYaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    aimAlignment = Math.cos(diff)
    // Stable U-turn: near 180° the shortest-arc sign is arbitrary — commit to
    // the direction we were already turning instead of flip-flopping.
    if (Math.abs(diff) > 2.75 && player.steerBias !== 0) {
      diff = Math.abs(diff) * player.steerBias
    }
    steer = clamp(diff * 1.4, -1, 1)
    // stepVehicle flips steer while reversing (reverseSign); cancel that so
    // the screen-relative aim stays authoritative.
    if (reversing) steer = -steer
  } else {
    // Chase cam (or no stick): A = left of nose, D = right of nose.
    steer = clamp(input.move.x, -1, 1)
  }
  if (Math.abs(steer) < 0.08) steer = 0
  if (Math.abs(steer) > 0.1) player.steerBias = Math.sign(steer)
  else if (inputMag < 0.12) player.steerBias = 0

  // During a kickflip, keep rolling forward — no brake cut mid-air.
  // Board/scooter auto-throttle scales with how aligned the nose already is
  // with the pressed direction: turn first, then accelerate. Tapping Left or
  // Right mid-ride pivots the board instead of lurching it sideways.
  const tricking = !!player.trick
  const aimThrottle = microRide && inputMag > 0.15
    ? inputMag * Math.max(0, aimAlignment)
    : 0
  const ctl = {
    throttle: tricking
      ? Math.max(input.throttle, 0.55)
      : (input.throttle > 0.01
        ? input.throttle
        : aimThrottle),
    brake: tricking ? 0 : input.brake,
    steer: tricking ? steer * 0.35 : steer,
    handbrake: tricking ? false : input.handbrake,
  }

  stepVehicle(v, v.handling, ctl, dt, world)

  const bounded = clampToBounds(v.x, v.z, data.world.bounds, 6)
  v.x = bounded.x
  v.z = bounded.z

  // Base pose, then trick overlay (kickflip = full spin about the long axis).
  let hop = 0
  let flip = 0
  if (player.trick) {
    player.trick.t += dt
    const u = clamp(player.trick.t / player.trick.duration, 0, 1)
    // Smooth hop arc + one clean longitudinal flip.
    hop = Math.sin(u * Math.PI) * (player.trick.hop || 0.9)
    flip = u * Math.PI * 2
    if (u >= 1) {
      player.trick = null
      hop = 0
      flip = 0
    }
  }

  v.y = hop
  v.mesh.position.set(v.x, hop, v.z)
  v.mesh.rotation.order = 'YXZ'
  v.mesh.rotation.y = v.yaw
  v.mesh.rotation.x = 0
  // Kickflip: rotate around the board's forward axis (local Z after yaw).
  v.mesh.rotation.z = flip
  if (!player.trick) {
    animateVehicle(v.mesh, dt, v.speed, steer, ctl.brake > 0.05)
    v.mesh.rotation.z = 0
  }

  const p = state.player
  p.x = v.x
  p.z = v.z
  p.y = hop
  p.yaw = v.yaw
  p.speed = Math.abs(v.speed)
  p.vx = Math.sin(v.yaw) * v.speed
  p.vz = Math.cos(v.yaw) * v.speed

  if (v.riderVisible) {
    syncRiderVisual(v, hop, flip)
    animatePed(
      player.ped,
      data.npcs,
      player.trick ? 'idle' : 'idle',
      dt,
      Math.abs(v.speed) * 0.22,
      beatPhase
    )
  }
  syncMarker(v.x, hop, v.z, v.kind === 'car' || !v.kind ? 1.7 : 1.08)
}

function syncRiderVisual(v, hop = 0, flip = 0) {
  if (!v?.riderVisible || !player.group) return
  // Rider rides the board: same hop, slight crouch spin feel.
  player.group.position.set(v.x, (v.riderHeight || 0) + hop, v.z)
  player.group.rotation.order = 'YXZ'
  player.group.rotation.y = v.yaw
  player.group.rotation.z = flip * 0.15
  player.group.rotation.x = player.trick ? -0.25 : 0
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

  for (const v of vehicles) {
    if (v.occupied) continue
    const d = (v.x - px) ** 2 + (v.z - pz) ** 2
    const radius = v.enterRadius || data.vehicles.player.enterRadius
    if (d <= radius * radius && d < bestD) {
      bestD = d
      best = {
        label: v.controls?.enter || (v.riderVisible ? 'RIDE' : 'ENTER'),
        prompt: (v.controls?.enter || (v.riderVisible ? 'RIDE' : 'ENTER')) + ' ' + v.label.toUpperCase(),
        kind: 'enter',
        target: v,
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
