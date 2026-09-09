/**
 * RAFFI WORLD — camera rig with selectable modes.
 *
 * Modes (cycle with CAM / C / V) — first C jumps into real 3D:
 *   classic — optional fixed 3/4 orthographic iso
 *   chase   — third-person perspective behind the player (GTA / Spidey vibe)
 *   free    — free-look third person; Q/X orbit yaw
 *   birds   — high bird's-eye ortho
 *
 * Movement input stays screen-relative via movementBasis() using currentYaw.
 */

import * as THREE from 'three'
import { data, state, damp, clamp, lerp } from './state.js'
import { cameraBoomFraction } from './camera-obstruction.js'

const DEG = Math.PI / 180

/** Ordered camera modes. Labels are for HUD / toast. First cycle step = 3D. */
export const CAMERA_MODES = [
  { id: 'classic', label: 'CLASSIC ISO', kind: 'ortho' },
  { id: 'chase', label: 'CHASE 3D', kind: 'persp' },
  { id: 'free', label: 'STREET 3D', kind: 'persp' },
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
  chaseDistance: 10,
  boomDistance: 10,
  orbitHold: 0,
  manualFootLook: false,
  shake: 0,
  modeIndex: 0,
  modeId: 'classic',
  drivingView: 'chase',
  reducedMotion: false,
}

export function initCamera(aspect) {
  const c = data.world.camera
  cam.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, c.near, c.far)
  cam.persp = new THREE.PerspectiveCamera(58, aspect, 0.12, 1400)
  cam.modeIndex = 0
  cam.modeId = 'classic'
  cam.boomDistance = 10
  cam.orbitHold = 0
  cam.manualFootLook = false
  cam.pinch = 1
  cam.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    cam.drivingView = localStorage.getItem('raffi-world-driving-view') === 'hood' ? 'hood' : 'chase'
    const reduced = localStorage.getItem('raffi-world-reduced-motion')
    if (reduced !== null) cam.reducedMotion = reduced === '1'
  } catch {}
  cam.camera = cam.ortho
  cam.desiredYaw = c.yawDeg * DEG
  cam.currentYaw = cam.desiredYaw
  cam.pitch = (c.pitchDeg || 55) * DEG * 0.55
  cam.desiredPitch = cam.pitch
  cam.target.set(state.player.x, (state.player.y || 0) + (c.footFocusHeight ?? 1.45), state.player.z)
  state.camera.orthoHeight = c.orthoHeightFoot
  state.camera.mode = cam.modeId
  updateProjection(aspect)
  return cam.camera
}

export function getCameraMode() {
  return CAMERA_MODES[cam.modeIndex] || CAMERA_MODES[0]
}

export function getDrivingView() { return cam.drivingView }
export function setDrivingView(view) {
  cam.drivingView = view === 'hood' ? 'hood' : 'chase'
  try { localStorage.setItem('raffi-world-driving-view', cam.drivingView) } catch {}
  return cam.drivingView
}
export function setReducedMotion(reduced) {
  cam.reducedMotion = !!reduced
  if (cam.reducedMotion) cam.shake = 0
  try { localStorage.setItem('raffi-world-reduced-motion', cam.reducedMotion ? '1' : '0') } catch {}
  return cam.reducedMotion
}

/** Cycle classic → chase 3D → free 3D → birds → classic. Returns mode descriptor. */
export function cycleCameraMode(dir = 1) {
  const n = CAMERA_MODES.length
  cam.modeIndex = (cam.modeIndex + (dir >= 0 ? 1 : n - 1)) % n
  const mode = CAMERA_MODES[cam.modeIndex]
  cam.modeId = mode.id
  cam.manualFootLook = false
  state.camera.mode = mode.id

  if (mode.kind === 'ortho') {
    cam.camera = cam.ortho
    // Restore classic snap yaw when returning to iso.
    if (mode.id === 'classic') {
      const snap = (data.world.camera.yawSnapDeg || 90) * DEG
      const baseYaw = data.world.camera.yawDeg * DEG
      cam.desiredYaw = baseYaw + Math.round((cam.currentYaw - baseYaw) / snap) * snap
      cam.desiredPitch = (data.world.camera.pitchDeg || 55) * DEG
    } else if (mode.id === 'birds') {
      cam.desiredPitch = (data.world.camera.birdsPitchDeg || 72) * DEG
    }
  } else {
    cam.camera = cam.persp
    // Snap behind the actor so the first frame of 3D is readable.
    cam.desiredYaw = (state.player.yaw || 0) + Math.PI
    cam.currentYaw = cam.desiredYaw
    const mounted = state.mode === 'vehicle'
    cam.desiredPitch = mounted
      ? (mode.id === 'free' ? 0.34 : 0.38)
      : (mode.id === 'free' ? 0.24 : data.world.camera.footPitch ?? 0.24)
    cam.pitch = cam.desiredPitch
    // Street-level chase pullback; rides need more room than foot.
    cam.chaseDistance = mounted ? (state.player.vehicle === 'skateboard' ? 7.2 : 13) : data.world.camera.footDistance ?? 6.2
    cam.boomDistance = cam.chaseDistance
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
    cam.persp.fov = (aspect < 0.8 ? 68 : 58) + (state.mode === 'vehicle' ? Math.min(6, Math.abs(state.player.speed || 0) * 0.12) : 0)
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
    cam.orbitHold = 2.5
    cam.manualFootLook = state.mode !== 'vehicle'
  }
}

/** Pinch zoom / chase distance. */
export function setPinch(v) {
  const c = data.world.camera
  cam.pinch = clamp(v, c.pinchMin, c.pinchMax)
  // The camera eases toward this zoom in updateCamera; it does not jump.
}

export function orbitView(dx, dy) {
  if (getCameraMode().kind !== 'persp') return
  cam.desiredYaw -= dx * 0.005
  cam.desiredPitch = clamp(cam.desiredPitch + dy * 0.0035, 0.06, 1.12)
  cam.orbitHold = 3
  cam.manualFootLook = state.mode !== 'vehicle'
}

export function addShake(amount) {
  if (cam.reducedMotion) return
  cam.shake = Math.min(cam.shake + amount, 1.2)
}

/**
 * @param dt        seconds
 * @param focus     {x, y?, z} world position to follow
 * @param velocity  {x, z} for look-ahead
 * @param aspect    viewport aspect
 */
export function updateCamera(dt, focus, velocity, aspect, collisionWorld = null) {
  // A first RAF timestamp can predate the end of a long shader/loading task.
  // Negative elapsed time makes exponential damping explode away from its target.
  dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0
  const c = data.world.camera
  const mode = getCameraMode()
  const mounted = state.mode === 'vehicle'
  const persp = mode.kind === 'persp'
  cam.orbitHold = Math.max(0, cam.orbitHold - dt)
  cam.chaseDistance = damp(cam.chaseDistance, (mounted ? (state.player.vehicle === 'skateboard' ? 7.2 + Math.min(1.6, Math.abs(state.player.speed || 0) * .08) : 13 + Math.min(4, Math.abs(state.player.speed || 0) * 0.12)) : c.footDistance ?? 6.2) * cam.pinch, 4, dt)

  // Ortho zoom target (foot vs vehicle).
  const wantHeight = mounted
    ? state.player.mountCameraHeight || c.orthoHeightVehicle
    : c.orthoHeightFoot
  state.camera.orthoHeight = damp(state.camera.orthoHeight, wantHeight, c.zoomLerp, dt)

  // Chase/free: almost no look-ahead — big look-ahead shoved the focus past the
  // car and parked the ride under the bottom of the frame ("behind the screen").
  let laScale = mounted ? c.lookAheadVehicle : c.lookAheadFoot
  if (persp) laScale = mounted ? 0.07 : 0.12
  const ax = clamp(velocity.x * laScale, -c.lookAheadMax, c.lookAheadMax)
  const az = clamp(velocity.z * laScale, -c.lookAheadMax, c.lookAheadMax)

  // Chase: stay behind the actor, snappy enough that W always matches "forward
  // on screen". Free: leave yaw to Q/X orbit only.
  if (mode.id === 'chase' && cam.orbitHold === 0) {
    if (mounted) {
      // Driving: snap hard behind the vehicle so W always reads as "forward".
      const behind = (state.player.yaw || 0) + Math.PI
      let dy = behind - cam.desiredYaw
      while (dy > Math.PI) dy -= Math.PI * 2
      while (dy < -Math.PI) dy += Math.PI * 2
      cam.desiredYaw += dy * (1 - Math.exp(-8 * dt))
      cam.desiredPitch = 0.38
    } else {
      // On foot: only glide behind the walker when they are (near) stopped.
      // While moving we freeze the rig yaw so the screen-relative stick keeps a
      // constant meaning — holding a direction walks in a straight line instead
      // of curving, and the camera eases behind again the moment you pause.
      const moving = (state.player.speed || 0) > 0.1
      if (!moving && !cam.manualFootLook) {
        const behind = (state.player.yaw || 0) + Math.PI
        let dy = behind - cam.desiredYaw
        while (dy > Math.PI) dy -= Math.PI * 2
        while (dy < -Math.PI) dy += Math.PI * 2
        cam.desiredYaw += dy * (1 - Math.exp(-4 * dt))
      }
      if (!cam.manualFootLook) cam.desiredPitch = c.footPitch ?? 0.24
    }
  } else if (mode.id === 'free') {
    // Keep free cam from going flat on the road when riding.
    const minP = 0.06
    cam.desiredPitch = clamp(cam.desiredPitch, minP, 1.15)
  } else if (mode.id === 'birds') {
    cam.desiredPitch = (c.birdsPitchDeg || 72) * DEG
  } else if (!persp) {
    cam.desiredPitch = (c.pitchDeg || 55) * DEG
  }

  const yawFollow = mode.id === 'chase' ? (mounted ? 16 : 14) : mode.kind === 'persp' ? 8 : 7.5
  cam.currentYaw = damp(cam.currentYaw, cam.desiredYaw, yawFollow, dt)
  cam.pitch = damp(cam.pitch, cam.desiredPitch, 9, dt)
  state.camera.yaw = cam.currentYaw
  state.camera.mode = mode.id

  const focusY = focus.y || 0
  // Stick hard to the actor in 3D so the mount never races past the lens.
  const follow = mode.id === 'chase'
    ? Math.max(c.followLerp, mounted ? 16 : 12)
    : (persp ? Math.max(c.followLerp, 10) : c.followLerp)
  // Aim the follow point slightly *above* the deck/roof so look-at isn't floor-level.
  const aimLift = persp ? (mounted ? 1.4 : c.footFocusHeight ?? 1.45) : 0
  cam.target.x = damp(cam.target.x, focus.x + ax, follow, dt)
  cam.target.z = damp(cam.target.z, focus.z + az, follow, dt)
  cam.target.y = damp(cam.target.y, focusY + aimLift, follow, dt)

  let sx = 0
  let sy = 0
  if (cam.shake > 0.001) {
    const t = state.time * 47
    sx = Math.sin(t) * cam.shake * 0.55
    sy = Math.cos(t * 1.37) * cam.shake * 0.55
    cam.shake = damp(cam.shake, 0, 6, dt)
  }

  if (persp) {
    updatePerspRig(dt, sx, sy, focus, collisionWorld)
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
  cam.ortho.userData.fogOffset = dist

  cam.ortho.position.set(
    cam.target.x + dirX * dist + sx,
    cam.target.y + dirY * dist + sy,
    cam.target.z + dirZ * dist
  )
  cam.ortho.lookAt(cam.target)
  cam.camera = cam.ortho
}

const boomOrigin = new THREE.Vector3()
const boomEnd = new THREE.Vector3()
const boomCandidates = []

function updatePerspRig(dt, sx, sy, focus, collisionWorld) {
  const mounted = state.mode === 'vehicle'
  // Hood is a deliberate preference for car chase mode, never a speed trigger.
  // Boards/scooters retain their readable third-person rider view.
  if (mounted && cam.modeId === 'chase' && cam.drivingView === 'hood' && !['skateboard', 'scooter'].includes(state.player.vehicle)) {
    const yaw = focus.yaw ?? state.player.yaw ?? 0
    const fx = Math.sin(yaw), fz = Math.cos(yaw)
    boomOrigin.set(focus.x, (focus.y || 0) + 1.65, focus.z)
    boomEnd.set(focus.x + fx * 1.05, (focus.y || 0) + 1.32, focus.z + fz * 1.05)
    let fraction = 1
    if (collisionWorld) {
      collisionWorld.query(focus.x, focus.z, 4, boomCandidates)
      fraction = cameraBoomFraction(boomOrigin, boomEnd, boomCandidates)
    }
    cam.persp.position.copy(boomOrigin).lerp(boomEnd, fraction)
    cam.persp.lookAt(cam.persp.position.x + fx * 30, cam.persp.position.y - 0.65, cam.persp.position.z + fz * 30)
    cam.camera = cam.persp
    return
  }
  const distance = cam.chaseDistance
  // Shoulder-height focus makes the street and horizon visible. The collision
  // sweep pulls the lens in before a wall can cover the player.
  boomOrigin.set(focus.x, (focus.y || 0) + (mounted ? 1.7 : 1.5), focus.z)
  const horizontal = Math.cos(cam.pitch) * distance
  boomEnd.set(
    cam.target.x + Math.sin(cam.currentYaw) * horizontal + (mounted ? 0 : Math.cos(cam.currentYaw) * 0.5),
    cam.target.y + Math.sin(cam.pitch) * distance,
    cam.target.z + Math.cos(cam.currentYaw) * horizontal - (mounted ? 0 : Math.sin(cam.currentYaw) * 0.5),
  )
  let fraction = 1
  if (collisionWorld) {
    collisionWorld.query((boomOrigin.x + boomEnd.x) / 2, (boomOrigin.z + boomEnd.z) / 2, distance / 2 + 2, boomCandidates)
    fraction = cameraBoomFraction(boomOrigin, boomEnd, boomCandidates)
  }
  const safeDistance = Math.max(0.2, distance * fraction - (fraction < 1 ? 0.12 : 0))
  // Snap inward for safety, ease outward to avoid pumping along doorways.
  cam.boomDistance = safeDistance < cam.boomDistance ? safeDistance : damp(cam.boomDistance, safeDistance, 5, dt)
  cam.persp.position.copy(boomOrigin).lerp(boomEnd, cam.boomDistance / distance)
  cam.persp.position.x += sx * 0.06
  cam.persp.position.y += sy * 0.06
  cam.persp.lookAt(
    cam.target.x + (mounted ? 0 : Math.cos(cam.currentYaw) * 0.5),
    cam.target.y + 0.2,
    cam.target.z - (mounted ? 0 : Math.sin(cam.currentYaw) * 0.5),
  )
  cam.camera = cam.persp
}

/**
 * Movement axes for WASD / stick.
 *
 * CHASE 3D while driving — body-relative:
 *   W = drive forward, A/D = steer relative to the vehicle.
 *
 * Walking in every view, plus FREE / CLASSIC / BIRDS driving — camera axes:
 *   W = into the frame, D = toward the right edge of the screen.
 *   Uses the camera's world +X / -Z so signs stay stable in every yaw.
 */
export function movementBasis() {
  const mode = getCameraMode()

  // Behind-the-back chase is body-relative ONLY when driving: the camera sits
  // hard behind the vehicle, so nose-relative already matches the screen.
  //
  // On FOOT it must NOT be body-relative. The walker's yaw follows its own
  // velocity, so a body-relative frame chases the heading every frame — hold a
  // diagonal and you spin in a full circle. On foot we always use the camera's
  // screen axes (below), and the chase rig freezes its yaw while you move so a
  // held direction travels in a straight line.
  if (mode.id === 'chase' && state.mode === 'vehicle') {
    return bodyRelativeBasis(state.player.yaw || 0)
  }

  const camera = cam.camera
  if (camera?.matrixWorld) {
    camera.updateMatrixWorld(true)
    const e = camera.matrixWorld.elements
    // Three.js: local -Z = look into the scene (flatten to XZ).
    let fx = -e[8]
    let fz = -e[10]
    const fLen = Math.hypot(fx, fz)
    if (fLen > 1e-4) {
      fx /= fLen
      fz /= fLen
      // Screen-right = look × world-up on XZ (RH): looking -Z → +X.
      const rx = -fz
      const rz = fx
      return { fx, fz, rx, rz }
    }
  }

  // Fallbacks if the camera matrix is not ready yet.
  if (mode.kind === 'persp') return bodyRelativeBasis(state.player.yaw || 0)
  return bodyRelativeBasis(cam.currentYaw + Math.PI)
}

/** Forward / right on XZ from a facing yaw (atan2(vx,vz) convention). */
function bodyRelativeBasis(yaw) {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  // Character right when facing +Z (yaw=0): +X.
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
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
