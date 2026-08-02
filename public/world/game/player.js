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
  // Player-only readability: a larger Vice-bright silhouette that cannot be
  // swallowed by fog or a foreground building under the fixed iso camera.
  ped.scale.setScalar(1.24)
  ped.material = ped.material.clone()
  ped.material.depthTest = false
  ped.material.depthWrite = false
  ped.material.fog = false
  ped.renderOrder = 20
  const group = new THREE.Group()
  group.name = 'player'
  group.add(ped)

  group.position.set(state.player.x, 0, state.player.z)
  scene.add(group)

  // A small world-space locator keeps the controlled actor readable against
  // roofs, asphalt, and neon paint without turning it into a floating HUD pin.
  // It deliberately ignores depth so foreground buildings cannot swallow the
  // player under the fixed isometric camera.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.88, 16),
    new THREE.MeshBasicMaterial({
      color: '#39E6FF',
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  )
  marker.name = 'player-locator'
  marker.rotation.x = -Math.PI / 2
  marker.renderOrder = 19
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

export function exitVehicle(collisionWorld = null) {
  const v = player.vehicle
  if (!v) return false
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

  // Steering is screen-relative too: pushing the stick left turns the car left
  // on screen, which is the only thing that feels right under a fixed camera.
  const screenRight = basis.rx * input.move.x + basis.fx * input.move.y
  const screenFwd = basis.rz * input.move.x + basis.fz * input.move.y
  let steer = 0
  const inputMag = Math.hypot(input.move.x, input.move.y)
  if (inputMag > 0.15) {
    const desiredYaw = Math.atan2(screenRight, screenFwd)
    let diff = desiredYaw - v.yaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    steer = clamp(diff * 1.6, -1, 1)
  }

  const ctl = {
    throttle: input.throttle > 0.01 ? input.throttle : inputMag > 0.15 ? inputMag : 0,
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
