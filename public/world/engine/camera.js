/**
 * RAFFI WORLD — the fixed 3/4 isometric rig.
 *
 * This is the most constrained system in the build and it is deliberate.
 * Orthographic, pitch locked at 55°, yaw locked except for 90° snaps. The
 * camera is parented to the player with damped follow and velocity look-ahead,
 * so the world scrolls underneath rather than the camera orbiting around.
 *
 * There is no free look and no first-person mode. See WORLD-BIBLE §4 for why
 * every other system depends on that staying true.
 */

import * as THREE from 'three'
import { data, state, damp, clamp, lerp } from './state.js'

const DEG = Math.PI / 180

export const cam = {
  camera: null,
  /** Damped follow target in world space. */
  target: new THREE.Vector3(),
  /** Yaw the rig is easing toward (90° snaps). */
  desiredYaw: 0,
  currentYaw: 0,
  pinch: 1,
  distance: 320,
  shake: 0,
}

export function initCamera(aspect) {
  const c = data.world.camera
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, c.near, c.far)
  cam.camera = camera
  cam.desiredYaw = c.yawDeg * DEG
  cam.currentYaw = cam.desiredYaw
  cam.target.set(state.player.x, 0, state.player.z)
  state.camera.orthoHeight = c.orthoHeightFoot
  updateProjection(aspect)
  return camera
}

export function updateProjection(aspect) {
  const camera = cam.camera
  const h = state.camera.orthoHeight * cam.pinch
  const w = h * aspect
  camera.left = -w / 2
  camera.right = w / 2
  camera.top = h / 2
  camera.bottom = -h / 2
  camera.updateProjectionMatrix()
}

/** Rotates the view by one 90° step. The only yaw control the player has. */
export function rotateView(dir = 1) {
  cam.desiredYaw += dir * data.world.camera.yawSnapDeg * DEG
}

/** Pinch zoom, clamped to the range in world.json. */
export function setPinch(v) {
  const c = data.world.camera
  cam.pinch = clamp(v, c.pinchMin, c.pinchMax)
}

export function addShake(amount) {
  cam.shake = Math.min(cam.shake + amount, 1.2)
}

/**
 * @param dt        seconds
 * @param focus     {x, z} world position to follow (player or vehicle)
 * @param velocity  {x, z} for look-ahead
 * @param aspect    viewport aspect
 */
export function updateCamera(dt, focus, velocity, aspect) {
  const c = data.world.camera

  // Zoom target depends on whether we are on foot or driving.
  const wantHeight = state.mode === 'vehicle'
    ? state.player.mountCameraHeight || c.orthoHeightVehicle
    : c.orthoHeightFoot
  state.camera.orthoHeight = damp(state.camera.orthoHeight, wantHeight, c.zoomLerp, dt)

  // Velocity look-ahead — pushes the camera ahead of travel so the player can
  // see where they are going without ever moving the camera manually.
  const laScale = state.mode === 'vehicle' ? c.lookAheadVehicle : c.lookAheadFoot
  const ax = clamp(velocity.x * laScale, -c.lookAheadMax, c.lookAheadMax)
  const az = clamp(velocity.z * laScale, -c.lookAheadMax, c.lookAheadMax)

  cam.target.x = damp(cam.target.x, focus.x + ax, c.followLerp, dt)
  cam.target.z = damp(cam.target.z, focus.z + az, c.followLerp, dt)
  cam.target.y = damp(cam.target.y, focus.y || 0, c.followLerp, dt)

  // Yaw eases to the nearest snap; nothing else may write currentYaw.
  cam.currentYaw = damp(cam.currentYaw, cam.desiredYaw, 7.5, dt)
  state.camera.yaw = cam.currentYaw

  const pitch = c.pitchDeg * DEG
  const horiz = Math.cos(pitch)
  const dirX = horiz * Math.sin(cam.currentYaw)
  const dirY = Math.sin(pitch)
  const dirZ = horiz * Math.cos(cam.currentYaw)

  let sx = 0
  let sy = 0
  if (cam.shake > 0.001) {
    const t = state.time * 47
    sx = Math.sin(t) * cam.shake * 0.55
    sy = Math.cos(t * 1.37) * cam.shake * 0.55
    cam.shake = damp(cam.shake, 0, 6, dt)
  }

  const camera = cam.camera
  camera.position.set(
    cam.target.x + dirX * cam.distance + sx,
    cam.target.y + dirY * cam.distance + sy,
    cam.target.z + dirZ * cam.distance
  )
  camera.lookAt(cam.target)

  state.camera.x = cam.target.x
  state.camera.z = cam.target.z

  updateProjection(aspect)
}

/**
 * World-space movement basis for the current yaw. Input is screen-relative:
 * pushing "up" on the stick must always walk away from the viewer regardless of
 * which 90° snap the camera is on.
 */
export function movementBasis() {
  const y = cam.currentYaw
  // Forward is the camera's horizontal facing projected onto the ground.
  const fx = -Math.sin(y)
  const fz = -Math.cos(y)
  // Right is forward rotated -90°.
  const rx = -fz
  const rz = fx
  return { fx, fz, rx, rz }
}

/** Ortho half-extents in world units — used for frustum-ish culling and the map. */
export function viewExtents(aspect) {
  const h = state.camera.orthoHeight * cam.pinch
  return { halfH: h / 2, halfW: (h * aspect) / 2 }
}

/** Debug flyover only. Never called in normal play. */
export function setFlyPosition(x, y, z) {
  cam.target.set(x, y, z)
}

export function lerpOrthoHeight(h, t) {
  state.camera.orthoHeight = lerp(state.camera.orthoHeight, h, t)
}
