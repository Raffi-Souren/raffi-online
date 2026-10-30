/**
 * RAFFI WORLD — game feel in one table. Systems report what happened (a bump,
 * a pole, a car impact) and this module decides the shake and sound, so juice
 * stays consistent and is easy to turn down.
 *
 * Every screen effect goes through camera.addShake, which honours reduced
 * motion, and is scaled by a 0..1 intensity the player can lower. Nothing here
 * touches simulation time: no hit-stop that would bend replay determinism.
 */

import { bus, data, state } from '../engine/state.js'
import { addShake, cam } from '../engine/camera.js'

const STORAGE_KEY = 'raffi-world-feel'

/** Which props respond to contact, and how. Bolted-down poles sway; stout ones clang. */
export const PROP_REACTIONS = {
  'streetlight-heritage': 'wobble',
  'streetlight-modern': 'wobble',
  'streetlight-strip': 'wobble',
  'neon-pole': 'wobble',
  'traffic-light': 'wobble',
  'crosswalk-signal': 'wobble',
  hydrant: 'rigid',
  bollard: 'rigid',
}

const WOBBLE = { omega: 9, zeta: 0.18, maxDeg: 4, perImpactDeg: 0.8 }

/**
 * How far a pole's sway reaches from its base: the full column and lamp head,
 * fading out by 1.4 m so long arms flex rather than swing nearby facades.
 */
function poleReach(tag) {
  const def = data.props?.props?.[tag]
  const core = (def?.collide?.r || 0.3) + 0.15
  let extent = core
  for (const part of def?.parts || []) {
    const width = part.w ?? (part.r || 0) * 2
    const depth = part.d ?? (part.r || 0) * 2
    extent = Math.max(extent, Math.hypot(Math.abs(part.x || 0) + width / 2, Math.abs(part.z || 0) + depth / 2))
  }
  return { core, reach: Math.min(1.4, Math.max(core + 0.4, extent)) }
}

export const feelState = {
  intensity: 1,
  lastBump: null,
  lastImpactEvent: null,
  lastPropEvent: null,
  wobbles: [],
  events: 0,
}

try {
  const saved = Number(globalThis.localStorage?.getItem(STORAGE_KEY))
  if (Number.isFinite(saved) && globalThis.localStorage?.getItem(STORAGE_KEY) !== null) feelState.intensity = Math.max(0, Math.min(1, saved))
} catch {}
cam.feelIntensity = feelState.intensity

export function setFeelIntensity(value) {
  feelState.intensity = Math.max(0, Math.min(1, Number(value) || 0))
  cam.feelIntensity = feelState.intensity
  try { globalThis.localStorage?.setItem(STORAGE_KEY, String(feelState.intensity)) } catch {}
  return feelState.intensity
}

/** Shake scaled by the player's intensity; camera.addShake drops it under reduced motion. */
function shake(amount) {
  if (amount > 0 && feelState.intensity > 0) addShake(amount * feelState.intensity)
}

/** A walked-into pedestrian: the plan comes from bump-core. */
export function feelBump(plan, impact) {
  feelState.lastBump = { tier: plan.tier, name: plan.name, impact, time: state.time }
  feelState.events++
  shake(plan.shake)
  bus.emit('sfx', plan.sfx)
}

/** A walked-into street prop. Poles start a damped sway; stout props clang. */
export function feelProp(collider, normalX, normalZ, impact) {
  const reaction = PROP_REACTIONS[collider.tag]
  if (!reaction || impact < 0.4) return
  const now = state.time
  if (feelState.lastPropEvent?.collider === collider && now - feelState.lastPropEvent.time < 0.6) return
  feelState.lastPropEvent = { collider, tag: collider.tag, reaction, impact, time: now }
  feelState.events++
  bus.emit('sfx', reaction === 'wobble' ? 'pole-tonk' : 'bump-thud')
  if (reaction !== 'wobble') return
  const amplitude = Math.min(WOBBLE.maxDeg, impact * WOBBLE.perImpactDeg) * Math.PI / 180
  let wobble = feelState.wobbles.find((entry) => entry.collider === collider)
  if (!wobble) {
    wobble = { collider, x: collider.x, z: collider.z, dirX: 0, dirZ: 0, angle: 0, velocity: 0, peak: 0, baseY: 0, ...poleReach(collider.tag) }
    feelState.wobbles.push(wobble)
  }
  // The pole leans away from the body that hit it.
  wobble.dirX = -normalX
  wobble.dirZ = -normalZ
  wobble.velocity += amplitude * WOBBLE.omega
  wobble.peak = Math.max(wobble.peak, amplitude)
  shake(0.02)
}

/** A car's speed into a wall or another body, from stepVehicle's lastImpact. */
export function feelCarImpact(impact) {
  if (!(impact > 2)) return
  const now = state.time
  if (feelState.lastImpactEvent && now - feelState.lastImpactEvent.time < 0.35) return
  feelState.lastImpactEvent = { impact, time: now }
  feelState.events++
  shake(Math.max(0.05, Math.min(0.6, impact * 0.05)))
  bus.emit('sfx', impact > 9 ? 'crash' : 'car-hit')
}

/** Advances pole sways (a damped spring per pole); call once per frame. */
export function updateFeel(dt) {
  if (!(dt > 0)) return
  const { omega, zeta } = WOBBLE
  for (let index = feelState.wobbles.length - 1; index >= 0; index--) {
    const wobble = feelState.wobbles[index]
    // Semi-implicit Euler is stable here: omega·dt stays far below 2 at frame rates.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
    const h = dt / steps
    for (let step = 0; step < steps; step++) {
      wobble.velocity += (-omega * omega * wobble.angle - 2 * zeta * omega * wobble.velocity) * h
      wobble.angle += wobble.velocity * h
    }
    if (Math.abs(wobble.angle) < 0.0002 && Math.abs(wobble.velocity) < 0.002) feelState.wobbles.splice(index, 1)
  }
}

/** Reduced motion or zero intensity turns off camera bob as well as shake. */
export function motionAllowed() {
  return !cam.reducedMotion && feelState.intensity > 0
}

/** Read-only snapshot for browser smokes (window.RAFFI_WORLD.feel()). */
export function feelSnapshot() {
  return {
    intensity: feelState.intensity,
    reducedMotion: !!cam.reducedMotion,
    shake: cam.shake || 0,
    lastBump: feelState.lastBump && { ...feelState.lastBump },
    lastImpactEvent: feelState.lastImpactEvent && { ...feelState.lastImpactEvent },
    lastPropEvent: feelState.lastPropEvent && { tag: feelState.lastPropEvent.tag, reaction: feelState.lastPropEvent.reaction, impact: feelState.lastPropEvent.impact, time: feelState.lastPropEvent.time },
    wobbles: feelState.wobbles.map((wobble) => ({ tag: wobble.collider.tag, x: wobble.x, z: wobble.z, angleDeg: wobble.angle * 180 / Math.PI, peakDeg: wobble.peak * 180 / Math.PI })),
    events: feelState.events,
  }
}

export function resetFeel() {
  feelState.lastBump = feelState.lastImpactEvent = feelState.lastPropEvent = null
  feelState.wobbles.length = 0
  feelState.events = 0
}
