/**
 * RAFFI WORLD — camera rig with selectable modes.
 *
 * Modes (cycle with CAM / C / V) — first C jumps into real 3D:
 *   classic — fixed 3/4 orthographic iso (default)
 *   chase   — third-person perspective behind the player (GTA / Spidey vibe)
 *   free    — free-look third person; Q/X orbit yaw
 *   birds   — high bird's-eye ortho
 *
 * Movement input stays screen-relative via movementBasis() using currentYaw.
 */

import * as THREE from 'three'
import { data, state, damp, clamp, lerp } from './state.js'

const DEG = Math.PI / 180

/** Ordered camera modes. Labels are for HUD / toast. First cycle step = 3D. */
export const CAMERA_MODES = [
  { id: 'classic', label: 'CLASSIC ISO', kind: 'ortho' },
  { id: 'chase', label: 'CHASE 3D', kind: 'persp' },
  { id: 'free', label: 'FREE 3D', kind: 'persp' },
  { id: 'birds', label: "BIRD'S EYE", kind: 'ortho' },
]

export const cam = {
  camera: null,
  ortho: null,
  persp: null,
  /** Damped follow target in world space. */
  target: new THREE.Vector3(),
  /** Yaw the rig is easing toward. */
  desiredYaw: 0,
  currentYaw: 0,
  /** Chase/free pitch (radians, look-down positive in our setup). */
  pitch: 0.42,
  desiredPitch: 0.42,
  pinch: 1,
  distance: 320,
  chaseDistance: 18,
  shake: 0,
  modeIndex: 0,
  modeId: 'classic',
}

export function initCamera(aspect) {
  const c = data.world.camera
  cam.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, c.near, c.far)
  cam.persp = new THREE.PerspectiveCamera(48, aspect, 0.6, 1400)
  cam.camera = cam.ortho
  cam.desiredYaw = c.yawDeg * DEG
  cam.currentYaw = cam.desiredYaw
  cam.pitch = (c.pitchDeg || 55) * DEG * 0.55
  cam.desiredPitch = cam.pitch
  cam.target.set(state.player.x, 0, state.player.z)
  state.camera.orthoHeight = c.orthoHeightFoot
  state.camera.mode = cam.modeId
  updateProjection(aspect)
  return cam.camera
}

export function getCameraMode() {
  return CAMERA_MODES[cam.modeIndex] || CAMERA_MODES[0]
}

/** Cycle classic → chase 3D → free 3D → birds → classic. Returns mode descriptor. */
export function cycleCameraMode(dir = 1) {
  const n = CAMERA_MODES.length
  cam.modeIndex = (cam.modeIndex + (dir >= 0 ? 1 : n - 1)) % n
  const mode = CAMERA_MODES[cam.modeIndex]
  cam.modeId = mode.id
  state.camera.mode = mode.id

  if (mode.kind === 'ortho') {
    cam.camera = cam.ortho
    // Restore classic snap yaw when returning to iso.
    if (mode.id === 'classic') {
      const snap = (data.world.camera.yawSnapDeg || 90) * DEG
      cam.desiredYaw = Math.round(cam.currentYaw / snap) * snap
      cam.desiredPitch = (data.world.camera.pitchDeg || 55) * DEG
    } else if (mode.id === 'birds') {
      cam.desiredPitch = (data.world.camera.birdsPitchDeg || 72) * DEG
    }
  } else {
    cam.camera = cam.persp
    // Snap behind the actor so the first frame of 3D is readable.
    cam.desiredYaw = (state.player.yaw || 0) + Math.PI
    cam.currentYaw = cam.desiredYaw
    cam.desiredPitch = mode.id === 'free' ? 0.42 : 0.36
    cam.pitch = cam.desiredPitch
    // Pull chase distance into a street-level range immediately.
    if (cam.chaseDistance < 14 || cam.chaseDistance > 28) cam.chaseDistance = 18
  }
  return mode
}

export function setCameraMode(id) {
  const idx = CAMERA_MODES.findIndex((m) => m.id === id)
  if (idx < 0) return getCameraMode()
  cam.modeIndex = (idx + CAMERA_MODES.length - 1) % CAMERA_MODES.length
  return cycleCameraMode(1)
}

export function updateProjection(aspect) {
  const mode = getCameraMode()
  if (mode.kind === 'persp') {
    cam.persp.aspect = Math.max(aspect, 0.01)
    cam.persp.fov = mode.id === 'free' ? 52 : 48
    cam.persp.updateProjectionMatrix()
    cam.camera = cam.persp
    return
  }

  const camera = cam.ortho
  const c = data.world.camera
  let h = state.camera.orthoHeight * cam.pinch
  if (mode.id === 'birds') {
    h *= c.birdsOrthoScale || 1.85
  }
  const w = h * aspect
  camera.left = -w / 2
  camera.right = w / 2
  camera.top = h / 2
  camera.bottom = -h / 2
  camera.near = c.near
  camera.far = c.far
  camera.updateProjectionMatrix()
  cam.camera = camera
}

/** Rotates the view. Iso: 90° snaps. Chase/free: continuous orbit. */
export function rotateView(dir = 1) {
  const mode = getCameraMode()
  if (mode.kind === 'ortho') {
    cam.desiredYaw += dir * (data.world.camera.yawSnapDeg || 90) * DEG
  } else {
    cam.desiredYaw += dir * 0.55
  }
}

/** Pinch zoom / chase distance. */
export function setPinch(v) {
  const c = data.world.camera
  cam.pinch = clamp(v, c.pinchMin, c.pinchMax)
  cam.chaseDistance = lerp(12, 34, (cam.pinch - c.pinchMin) / Math.max(0.01, c.pinchMax - c.pinchMin))
}

export function addShake(amount) {
  cam.shake = Math.min(cam.shake + amount, 1.2)
}

/**
 * @param dt        seconds
 * @param focus     {x, y?, z} world position to follow
 * @param velocity  {x, z} for look-ahead
 * @param aspect    viewport aspect
 */
export function updateCamera(dt, focus, velocity, aspect) {
  const c = data.world.camera
  const mode = getCameraMode()

  // Ortho zoom target (foot vs vehicle).
  const wantHeight = state.mode === 'vehicle'
    ? state.player.mountCameraHeight || c.orthoHeightVehicle
    : c.orthoHeightFoot
  state.camera.orthoHeight = damp(state.camera.orthoHeight, wantHeight, c.zoomLerp, dt)

  const laScale = state.mode === 'vehicle' ? c.lookAheadVehicle : c.lookAheadFoot
  const ax = clamp(velocity.x * laScale, -c.lookAheadMax, c.lookAheadMax)
  const az = clamp(velocity.z * laScale, -c.lookAheadMax, c.lookAheadMax)

  // Chase: stay behind the actor, snappy enough that W always matches "forward
  // on screen". Free: leave yaw to Q/X orbit only.
  if (mode.id === 'chase') {
    const behind = (state.player.yaw || 0) + Math.PI
    let dy = behind - cam.desiredYaw
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    // Fast catch-up so turning doesn't fight movementBasis lag.
    cam.desiredYaw += dy * Math.min(1, dt * 8.5)
    cam.desiredPitch = 0.34
  } else if (mode.id === 'free') {
    cam.desiredPitch = clamp(cam.desiredPitch, 0.12, 1.1)
  } else if (mode.id === 'birds') {
    cam.desiredPitch = (c.birdsPitchDeg || 72) * DEG
  } else {
    cam.desiredPitch = (c.pitchDeg || 55) * DEG
  }

  const yawFollow = mode.id === 'chase' ? 14 : mode.kind === 'persp' ? 8 : 7.5
  cam.currentYaw = damp(cam.currentYaw, cam.desiredYaw, yawFollow, dt)
  cam.pitch = damp(cam.pitch, cam.desiredPitch, 8, dt)
  state.camera.yaw = cam.currentYaw
  state.camera.mode = mode.id

  const focusY = focus.y || 0
  // Tighter follow in chase so the character doesn't skate under a lagging rig.
  const follow = mode.id === 'chase' ? Math.max(c.followLerp, 11) : c.followLerp
  cam.target.x = damp(cam.target.x, focus.x + ax, follow, dt)
  cam.target.z = damp(cam.target.z, focus.z + az, follow, dt)
  cam.target.y = damp(cam.target.y, focusY + (mode.kind === 'persp' ? 1.15 : 0), follow, dt)

  let sx = 0
  let sy = 0
  if (cam.shake > 0.001) {
    const t = state.time * 47
    sx = Math.sin(t) * cam.shake * 0.55
    sy = Math.cos(t * 1.37) * cam.shake * 0.55
    cam.shake = damp(cam.shake, 0, 6, dt)
  }

  if (mode.kind === 'persp') {
    updatePerspRig(mode, sx, sy)
  } else {
    updateOrthoRig(mode, c, sx, sy)
  }

  state.camera.x = cam.target.x
  state.camera.z = cam.target.z
  updateProjection(aspect)
}

function updateOrthoRig(mode, c, sx, sy) {
  const pitch = mode.id === 'birds'
    ? (c.birdsPitchDeg || 72) * DEG
    : (c.pitchDeg || 55) * DEG
  const horiz = Math.cos(pitch)
  const dirX = horiz * Math.sin(cam.currentYaw)
  const dirY = Math.sin(pitch)
  const dirZ = horiz * Math.cos(cam.currentYaw)
  const dist = mode.id === 'birds' ? cam.distance * 1.15 : cam.distance

  cam.ortho.position.set(
    cam.target.x + dirX * dist + sx,
    cam.target.y + dirY * dist + sy,
    cam.target.z + dirZ * dist
  )
  cam.ortho.lookAt(cam.target)
  cam.camera = cam.ortho
}

function updatePerspRig(mode, sx, sy) {
  const dist = cam.chaseDistance * (state.mode === 'vehicle' ? 1.45 : 1.05)
  const pitch = cam.pitch
  const yaw = cam.currentYaw
  // Camera sits on the orbit ring and looks at the actor (GTA III / VC style).
  const horiz = Math.cos(pitch)
  const ox = Math.sin(yaw) * horiz * dist
  const oy = Math.sin(pitch) * dist + (state.mode === 'vehicle' ? 1.6 : 0.85)
  const oz = Math.cos(yaw) * horiz * dist

  cam.persp.position.set(
    cam.target.x + ox + sx * 0.12,
    Math.max(1.2, cam.target.y + oy + sy * 0.12),
    cam.target.z + oz
  )
  const look = new THREE.Vector3(
    cam.target.x,
    cam.target.y + (mode.id === 'free' ? 1.25 : 1.45),
    cam.target.z
  )
  cam.persp.lookAt(look)
  cam.camera = cam.persp
}

/**
 * Screen-relative movement axes from the *actual* camera pose.
 * W / stick-up always moves into the scene (away from the viewer), never
 * inverted under chase/free. Deriving from camera.position → target avoids the
 * lag/invert bugs that came from hand-rolled yaw offsets.
 */
export function movementBasis() {
  const camera = cam.camera
  if (camera) {
    let lx = cam.target.x - camera.position.x
    let lz = cam.target.z - camera.position.z
    const len = Math.hypot(lx, lz)
    if (len > 1e-4) {
      lx /= len
      lz /= len
      // Screen-right = look × up on XZ (RH): looking -Z → right is +X.
      const rx = -lz
      const rz = lx
      return { fx: lx, fz: lz, rx, rz }
    }
  }
  // Fallback if camera not ready.
  const y = cam.currentYaw
  const fx = -Math.sin(y)
  const fz = -Math.cos(y)
  return { fx, fz, rx: -fz, rz: fx }
}

export function viewExtents(aspect) {
  const mode = getCameraMode()
  if (mode.kind === 'persp') {
    const dist = cam.chaseDistance
    const halfH = Math.tan((cam.persp.fov * DEG) / 2) * dist
    return { halfH, halfW: halfH * aspect }
  }
  let h = state.camera.orthoHeight * cam.pinch
  if (mode.id === 'birds') h *= data.world.camera.birdsOrthoScale || 1.85
  return { halfH: h / 2, halfW: (h * aspect) / 2 }
}

export function setFlyPosition(x, y, z) {
  cam.target.set(x, y, z)
}

export function lerpOrthoHeight(h, t) {
  state.camera.orthoHeight = lerp(state.camera.orthoHeight, h, t)
}
