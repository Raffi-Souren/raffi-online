/**
 * RAFFI WORLD — collision and vehicle dynamics.
 *
 * Static boxes, circles and ramps live in a uniform spatial hash, with nearby
 * actor bodies supplied separately. Resolution is iterative
 * push-out. Collisions push and slow, they never destroy — see WORLD-BIBLE §2.
 *
 * Note for the replay mechanic: the order colliders come out of the hash is
 * insertion order per cell, and actors are resolved in pool order, which is not
 * stable across runs. That is one of the two honest sources of path divergence
 * the rewind visualises. Do not "fix" it by sorting.
 */

import { clamp } from './state.js'

const CELL = 24

export class CollisionWorld {
  constructor() {
    this.cells = new Map()
    this.all = []
  }

  _key(cx, cz) { return cx * 73856093 ^ cz * 19349663 }

  add(collider) {
    if (!collider) return
    this.all.push(collider)
    let minX, maxX, minZ, maxZ
    if (collider.type === 'circle') {
      minX = collider.x - collider.r; maxX = collider.x + collider.r
      minZ = collider.z - collider.r; maxZ = collider.z + collider.r
    } else if (collider.type === 'ramp') {
      const ext = Math.max(collider.w, collider.d) / 2
      minX = collider.x - ext; maxX = collider.x + ext
      minZ = collider.z - ext; maxZ = collider.z + ext
    } else {
      const cos = Math.abs(Math.cos(collider.ry || 0))
      const sin = Math.abs(Math.sin(collider.ry || 0))
      const ex = cos * collider.hx + sin * collider.hz
      const ez = sin * collider.hx + cos * collider.hz
      minX = collider.x - ex; maxX = collider.x + ex
      minZ = collider.z - ez; maxZ = collider.z + ez
    }
    const x0 = Math.floor(minX / CELL)
    const x1 = Math.floor(maxX / CELL)
    const z0 = Math.floor(minZ / CELL)
    const z1 = Math.floor(maxZ / CELL)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this._key(cx, cz)
        let list = this.cells.get(k)
        if (!list) { list = []; this.cells.set(k, list) }
        list.push(collider)
      }
    }
  }

  addAll(list) { for (const c of list) this.add(c) }

  /** Colliders in the cells overlapping a circle. May contain duplicates. */
  query(x, z, r, out = []) {
    out.length = 0
    const x0 = Math.floor((x - r) / CELL)
    const x1 = Math.floor((x + r) / CELL)
    const z0 = Math.floor((z - r) / CELL)
    const z1 = Math.floor((z + r) / CELL)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(this._key(cx, cz))
        if (!list) continue
        for (const c of list) if (!out.includes(c)) out.push(c)
      }
    }
    return out
  }

  clear() { this.cells.clear(); this.all.length = 0 }
}

const scratch = []

/**
 * Pushes a circle out of everything it overlaps.
 * @returns {{x, y, z, hit, normalX, normalZ}} resolved position + surface info
 */
export function resolveCircle(world, x, z, r, iterations = 2, bodies = []) {
  let px = x
  let pz = z
  let hit = false
  let nx = 0
  let nz = 0
  let groundY = 0

  for (let iter = 0; iter < iterations; iter++) {
    const near = world.query(px, pz, r + 1, scratch)
    // Static geometry gets the final correction when an actor crowds a wall.
    near.unshift(...bodies)
    for (const c of near) {
      if (c.type === 'circle') {
        const dx = px - c.x
        const dz = pz - c.z
        const dist = Math.hypot(dx, dz)
        const min = r + c.r
        if (dist < min) {
          const directionX = dist > 0.0001 ? dx / dist : 1
          const directionZ = dist > 0.0001 ? dz / dist : 0
          px += directionX * (min - dist)
          pz += directionZ * (min - dist)
          nx += directionX
          nz += directionZ
          hit = true
        }
      } else if (c.type === 'ramp') {
        // Ramps are drivable, not solid: they raise the ground instead.
        const local = worldToLocal(px - c.x, pz - c.z, -c.ry)
        if (Math.abs(local.x) <= c.w / 2 && Math.abs(local.z) <= c.d / 2) {
          const t = clamp((c.d / 2 - local.z) / c.d, 0, 1)
          groundY = Math.max(groundY, t * c.h)
        }
      } else {
        const angle = c.ry || 0
        const local = worldToLocal(px - c.x, pz - c.z, -angle)
        const closestX = clamp(local.x, -c.hx, c.hx)
        const closestZ = clamp(local.z, -c.hz, c.hz)
        const dx = local.x - closestX
        const dz = local.z - closestZ
        const distSq = dx * dx + dz * dz
        if (distSq < r * r) {
          let pushX = 0, pushZ = 0
          if (distSq > 0.000001) {
            const dist = Math.sqrt(distSq)
            pushX = dx * (r - dist) / dist
            pushZ = dz * (r - dist) / dist
          } else {
            const ox = c.hx + r - Math.abs(local.x)
            const oz = c.hz + r - Math.abs(local.z)
            if (ox < oz) pushX = (Math.sign(local.x) || 1) * ox
            else pushZ = (Math.sign(local.z) || 1) * oz
          }
          const push = worldToLocal(pushX, pushZ, angle)
          const length = Math.hypot(push.x, push.z)
          px += push.x
          pz += push.z
          if (length > 0) { nx += push.x / length; nz += push.z / length }
          hit = true
        }
      }
    }
  }

  const nl = Math.hypot(nx, nz)
  return {
    x: px,
    z: pz,
    y: groundY,
    hit,
    normalX: nl > 0 ? nx / nl : 0,
    normalZ: nl > 0 ? nz / nl : 0,
  }
}

/** Resolve the whole movement path so a sprint or long frame cannot skip a thin body. */
export function moveCircle(world, x, z, dx, dz, r, bodies = []) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.max(0.1, r * 0.5)))
  let result = { x, z, y: 0, hit: false, normalX: 0, normalZ: 0 }
  let normalX = 0, normalZ = 0, hit = false
  for (let step = 0; step < steps; step++) {
    result = resolveCircle(world, result.x + dx / steps, result.z + dz / steps, r, 4, bodies)
    hit ||= result.hit
    normalX += result.normalX
    normalZ += result.normalZ
  }
  const length = Math.hypot(normalX, normalZ)
  return { ...result, hit, normalX: length ? normalX / length : 0, normalZ: length ? normalZ / length : 0 }
}

function worldToLocal(dx, dz, ry) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return { x: dx * c - dz * s, z: dx * s + dz * c }
}

/** Keeps an actor inside the playable rectangle. */
export function clampToBounds(x, z, bounds, margin = 4) {
  return {
    x: clamp(x, bounds.minX + margin, bounds.maxX - margin),
    z: clamp(z, bounds.minZ + margin, bounds.maxZ - margin),
  }
}

// ------------------------------------------------------------- vehicle ---

/**
 * Arcade car step. Grip-based, drift on handbrake, soft speed cap, no damage
 * model beyond cosmetic. Deliberately simple: this is a satire city, not a sim.
 *
 * @param v   vehicle state {x,z,yaw,speed,lateral,angularVel}
 * @param h   handling block from vehicles.json
 * @param ctl {throttle, brake, steer, handbrake} each -1..1 / 0..1
 */
export function stepVehicle(v, h, ctl, dt, world) {
  const throttle = clamp(ctl.throttle, 0, 1)
  const brake = clamp(ctl.brake, 0, 1)
  const steer = clamp(ctl.steer, -1, 1)
  const handbrake = ctl.handbrake ? 1 : 0

  // Longitudinal: S brakes then reverses with real bite (no long dead zone).
  let accel = throttle * h.accel
  if (brake > 0) {
    if (v.speed > 0.12) accel -= brake * h.brake
    else accel -= brake * h.accel * (h.reversePower ?? 0.95)
  }
  if (throttle > 0.01 && v.speed < -0.12) accel = throttle * h.brake * 0.85
  accel -= v.speed * h.drag * 0.12
  v.speed += accel * dt

  const top = Math.max(h.topSpeed, 1)
  const bottom = -h.reverse
  if (v.speed > top) v.speed += (top - v.speed) * Math.min(1, dt * 4)
  if (v.speed < bottom) v.speed += (bottom - v.speed) * Math.min(1, dt * 4)

  if (throttle < 0.01 && brake < 0.01) {
    const fric = (h.coastFriction ?? 3.4) * dt
    if (Math.abs(v.speed) < fric) v.speed = 0
    else v.speed -= Math.sign(v.speed) * fric
  }

  // Steer at crawl — min authority so A/D works when almost stopped.
  const speedFrac = Math.min(1, Math.abs(v.speed) / top)
  const authority = 1 - h.steerFalloff * speedFrac
  const reverseSign = v.speed < -0.15 ? -1 : 1
  const steerRate = h.steerRate * authority * reverseSign
  const steerSpeed = h.steerSpeed || 3.2
  const minAuthority = h.minSteerAuthority ?? 0.55
  const speedFactor = Math.abs(steer) > 0.05
    ? Math.max(minAuthority, Math.min(1, Math.abs(v.speed) / steerSpeed))
    : Math.min(1, Math.abs(v.speed) / steerSpeed)
  const targetAngular = steer * steerRate * speedFactor
  const yawLerp = Math.abs(v.speed) < 6 ? 14 : 9
  v.angularVel += (targetAngular - v.angularVel) * Math.min(1, dt * yawLerp)
  v.yaw += v.angularVel * dt

  const grip = handbrake ? h.handbrakeGrip : h.grip
  v.lateral += -v.angularVel * v.speed * dt
  v.lateral -= v.lateral * Math.min(1, grip * dt)
  v.slip = Math.min(1, Math.abs(v.lateral) / 6)

  const fx = Math.sin(v.yaw)
  const fz = Math.cos(v.yaw)
  const rx = fz
  const rz = -fx

  let nx = v.x + (fx * v.speed + rx * v.lateral) * dt
  let nz = v.z + (fz * v.speed + rz * v.lateral) * dt

  const radius = v.collisionRadius || h.collisionRadius || 1.7
  const res = resolveCircle(world, nx, nz, radius, 3)
  if (res.hit) {
    // Kill only velocity into the wall so reverse can free you.
    let vx = fx * v.speed + rx * v.lateral
    let vz = fz * v.speed + rz * v.lateral
    const intoWall = -(vx * res.normalX + vz * res.normalZ)
    if (intoWall > 0) {
      vx += res.normalX * intoWall
      vz += res.normalZ * intoWall
    }
    v.speed = vx * fx + vz * fz
    v.lateral = vx * rx + vz * rz
    if (brake > 0.2 && throttle < 0.05 && intoWall > -0.5) {
      const escape = (h.escapeBoost ?? 3.2) * brake * dt
      res.x += res.normalX * escape
      res.z += res.normalZ * escape
      if (v.speed > -0.5) v.speed = Math.min(v.speed, -h.accel * 0.15 * brake)
    }
    v.lastImpact = Math.max(0, intoWall)
    v.stuckFrames = (v.stuckFrames || 0) + 1
  } else {
    v.lastImpact = 0
    v.stuckFrames = 0
  }

  v.x = res.x
  v.z = res.z
  v.y = res.y
  return v
}
