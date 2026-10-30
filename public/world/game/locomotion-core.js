/**
 * RAFFI WORLD — on-foot locomotion: input direction in; velocity, facing and
 * gait out. Pure (no DOM, no three.js) so node --test can pin the feel.
 *
 * Weight before speed: velocity moves toward the wanted velocity at a bounded
 * acceleration instead of snapping, and the body turns on a critically damped
 * spring with a hard turn-rate cap, so a 180° input reads as a plant and pivot
 * rather than a pop. Tuning lives in data/movement.json.
 */

const DEG = Math.PI / 180

/** Fallback tuning; data/movement.json overrides every field it names. */
export const DEFAULT_MOVEMENT = {
  walkSpeed: 2.8,
  runSpeed: 6.0,
  accelWalk: 12,
  accelRun: 14,
  decel: 16,
  brakeReverse: 22,
  reverseAngleDeg: 120,
  stopFloor: 0.15,
  plantSpeed: 4,
  plantTime: 0.18,
  turnOmega: 14,
  turnRateWalkDeg: 540,
  turnRateRunDeg: 360,
  turnInPlaceSpeed: 0.6,
  turnInPlaceAngleDeg: 100,
  turnInPlaceAccel: 0.25,
  runBlendTime: 0.25,
  leanGain: 0.012,
  leanMaxDeg: 8,
  pitchMaxDeg: 3,
  postureRate: 10,
  strideLength: 1.5,
  wallBrush: 0.92,
  inputBufferMs: 120,
  coyoteMs: 100,
  headBob: { walk: 0.012, run: 0.025 },
}

export function movementTuning(data) {
  return { ...DEFAULT_MOVEMENT, ...(data || {}), headBob: { ...DEFAULT_MOVEMENT.headBob, ...(data?.headBob || {}) } }
}

export function createLocomotion(yaw = 0) {
  return { vx: 0, vz: 0, speed: 0, yaw, yawRate: 0, turnSign: 0, lean: 0, pitch: 0, runBlend: 0, plant: 0, stride: 0 }
}

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt))

/**
 * One fixed step of on-foot movement. Mutates and returns `s`.
 * @param s      state from createLocomotion()
 * @param input  { x, z } unit world direction, `magnitude` 0..1, `run`,
 *               optional `scale` (stagger or wall brush, multiplies target speed)
 * @param dt     seconds
 * @param t      tuning from movementTuning()
 */
export function stepLocomotion(s, input, dt, t) {
  if (!(dt > 0)) return s
  const speed = Math.hypot(s.vx, s.vz)
  const magnitude = clamp(input.magnitude || 0, 0, 1)
  const moving = magnitude > 0.01
  const dx = moving ? input.x : 0
  const dz = moving ? input.z : 0
  const target = (input.run ? t.runSpeed : t.walkSpeed) * magnitude * (input.scale ?? 1)

  // Asking to go the other way at speed brakes first, with a short plant.
  const reversing = moving && speed > t.turnInPlaceSpeed &&
    (s.vx * dx + s.vz * dz) / speed < Math.cos(t.reverseAngleDeg * DEG)
  if (reversing && speed > t.plantSpeed && s.plant <= 0) s.plant = t.plantTime

  let wantX = 0, wantZ = 0, rate = t.decel
  if (reversing) rate = t.brakeReverse
  else if (moving) {
    wantX = dx * target
    wantZ = dz * target
    rate = input.run ? t.accelRun : t.accelWalk
    // A body facing well away turns before it strides out.
    if (speed < t.turnInPlaceSpeed && Math.abs(wrap(Math.atan2(dx, dz) - s.yaw)) > t.turnInPlaceAngleDeg * DEG) rate *= t.turnInPlaceAccel
    if (target < speed) rate = Math.max(rate, t.decel)
  }

  // Linear acceleration toward the wanted velocity, never past it.
  const ex = wantX - s.vx
  const ez = wantZ - s.vz
  const error = Math.hypot(ex, ez)
  const reach = rate * dt
  if (error <= reach) { s.vx = wantX; s.vz = wantZ }
  else { s.vx += ex / error * reach; s.vz += ez / error * reach }
  let next = Math.hypot(s.vx, s.vz)
  if (!moving && next < t.stopFloor) { s.vx = 0; s.vz = 0; next = 0 }

  // Facing: an exact critically damped spring toward the input direction,
  // capped by the turn rate so no single step can pop the body around.
  if (moving) {
    let error = wrap(Math.atan2(dx, dz) - s.yaw)
    // At ~180° the shortest arc flips sign; keep turning the committed way.
    if (Math.abs(error) > Math.PI - 0.2 && s.turnSign) error = s.turnSign * Math.abs(error)
    const omega = t.turnOmega
    const offset = -error
    const j1 = s.yawRate + offset * omega
    const decay = Math.exp(-omega * dt)
    const nextOffset = decay * (offset + j1 * dt)
    const maxRate = (input.run ? t.turnRateRunDeg : t.turnRateWalkDeg) * DEG
    const delta = clamp(nextOffset - offset, -maxRate * dt, maxRate * dt)
    s.yawRate = clamp(decay * (s.yawRate - j1 * omega * dt), -maxRate, maxRate)
    s.yaw = wrap(s.yaw + delta)
    s.turnSign = Math.abs(error) > 0.05 ? Math.sign(error) : 0
  } else {
    s.yawRate = approach(s.yawRate, 0, t.turnOmega, dt)
    s.turnSign = 0
  }

  // Posture: lean into turns, tip forward under acceleration.
  const leanMax = t.leanMaxDeg * DEG
  s.lean = approach(s.lean, clamp(s.yawRate * next * t.leanGain, -leanMax, leanMax), t.postureRate, dt)
  const accel = (next - speed) / dt
  s.pitch = approach(s.pitch, t.pitchMaxDeg * DEG * clamp(accel / t.accelRun, 0, 1), t.postureRate, dt)

  const blend = clamp((next - t.walkSpeed) / (t.runSpeed - t.walkSpeed), 0, 1)
  const blendStep = dt / t.runBlendTime
  s.runBlend = s.runBlend < blend ? Math.min(blend, s.runBlend + blendStep) : Math.max(blend, s.runBlend - blendStep)
  s.plant = Math.max(0, s.plant - dt)
  s.stride += next * dt / t.strideLength
  s.speed = next
  return s
}

/** Animation playback rate that keeps a clip's feet planted at this speed. */
export function strideTimeScale(speed, clipStrideSpeed) {
  if (!(clipStrideSpeed > 0)) return 1
  return clamp(speed / clipStrideSpeed, 0.7, 1.4)
}

/** A press made slightly before it becomes legal still counts (input buffer). */
export function createActionBuffer(windowMs = DEFAULT_MOVEMENT.inputBufferMs) {
  return { pressedAt: -Infinity, window: windowMs / 1000 }
}

export function bufferPress(buffer, now) {
  buffer.pressedAt = now
}

/** True once when a buffered press is still fresh and the action is now legal. */
export function consumeBuffered(buffer, now, legal) {
  if (!legal || now - buffer.pressedAt > buffer.window + 1e-9) return false
  buffer.pressedAt = -Infinity
  return true
}

/** Coyote time: a jump stays legal briefly after leaving a lip, rail or kerb. */
export function withinCoyote(leftAt, now, windowMs = DEFAULT_MOVEMENT.coyoteMs) {
  return Number.isFinite(leftAt) && now - leftAt >= 0 && now - leftAt <= windowMs / 1000 + 1e-9
}
