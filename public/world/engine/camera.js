/**
 * RAFFI WORLD — camera rig with selectable modes.
 *
 * Modes (cycle with CAM / C):
 *   classic — original fixed 3/4 orthographic iso (WORLD-BIBLE default)
 *   birds   — high bird's-eye ortho so streets between buildings read
 *   chase   — third-person behind the player (perspective, GTA/Vice City vibe)
 *   free    — free-look third person; Q/X orbit yaw, pitch stays comfortable
 *
 * Movement input stays screen-relative via movementBasis() using currentYaw.
 */

import * as THREE from 'three'
import { data, state, damp, clamp, lerp } from './state.js'

const DEG = Math.PI / 180

/** Ordered camera modes. Labels are for HUD / toast. */
export const CAMERA_MODES = [
  { id: 'classic', label: 'CLASSIC ISO', kind: 'ortho' },
  { id: 'birds', label: "BIRD'S EYE", kind: 'ortho' },
  { id: 'chase', label: 'CHASE CAM', kind: 'persp' },
  { id: 'free', label: 'FREE 3D', kind: 'persp' },
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

/** Cycle classic → birds → chase → free → classic. Returns new mode descriptor. */
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
    }
  } else {
    cam.camera = cam.persp
    if (mode.id === 'chase') {
      // Align behind player facing.
      cam.desiredYaw = (state.player.yaw || 0) + Math.PI
      cam.desiredPitch = 0.38
    }
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

  // Chase / free: ease yaw toward behind-player when not free-orbiting heavily.
  if (mode.id === 'chase') {
    const behind = (state.player.yaw || 0) + Math.PI
    let dy = behind - cam.desiredYaw
    while (dy > Math.PI) dy -= Math.PI * 2
    while (dy < -Math.PI) dy += Math.PI * 2
    cam.desiredYaw += dy * Math.min(1, dt * 3.2)
    cam.desiredPitch = damp(cam.desiredPitch, 0.36, 4, dt)
  } else if (mode.id === 'free') {
    cam.desiredPitch = clamp(cam.desiredPitch, 0.12, 1.1)
  } else if (mode.id === 'birds') {
    // High look-down; keep iso yaw snaps.
    cam.desiredPitch = (c.birdsPitchDeg || 72) * DEG
  } else {
    cam.desiredPitch = (c.pitchDeg || 55) * DEG
  }

  cam.currentYaw = damp(cam.currentYaw, cam.desiredYaw, mode.kind === 'persp' ? 6.5 : 7.5, dt)
  cam.pitch = damp(cam.pitch, cam.desiredPitch, 6, dt)
  state.camera.yaw = cam.currentYaw
  state.camera.mode = mode.id

  const focusY = focus.y || 0
  cam.target.x = damp(cam.target.x, focus.x + ax, c.followLerp, dt)
  cam.target.z = damp(cam.target.z, focus.z + az, c.followLerp, dt)
  cam.target.y = damp(cam.target.y, focusY + (mode.kind === 'persp' ? 1.4 : 0), c.followLerp, dt)

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
  const dist = cam.chaseDistance * (state.mode === 'vehicle' ? 1.35 : 1)
  const pitch = cam.pitch
  const yaw = cam.currentYaw
  // Position behind/above the target looking at it (Vice City / GTA III feel).
  const horiz = Math.cos(pitch)
  const ox = Math.sin(yaw) * horiz * dist
  const oy = Math.sin(pitch) * dist + (state.mode === 'vehicle' ? 1.2 : 0.4)
  const oz = Math.cos(yaw) * horiz * dist

  cam.persp.position.set(
    cam.target.x + ox + sx * 0.15,
    cam.target.y + oy + sy * 0.15,
    cam.target.z + oz
  )
  const look = cam.target.clone()
  look.y += mode.id === 'free' ? 1.1 : 1.35
  cam.persp.lookAt(look)
  cam.camera = cam.persp
}

/**
 * World-space movement basis for the current yaw. Input is screen-relative:
 * pushing "up" on the stick walks away from the viewer in the active mode.
 */
export function movementBasis() {
  const mode = getCameraMode()
  let y = cam.currentYaw
  if (mode.kind === 'persp') {
    // In chase/free, "forward" is the camera's ground-projected facing
    // (from camera toward target ≈ -orbit direction).
    y = cam.currentYaw + Math.PI
  }
  const fx = -Math.sin(y)
  const fz = -Math.cos(y)
  const rx = -fz
  const rz = fx
  return { fx, fz, rx, rz }
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
