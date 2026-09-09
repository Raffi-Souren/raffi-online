/** Browser-independent audio preferences and distance-based footstep cadence. */
export function normalizeVolume(value, fallback = 1) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !value.trim())) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback
}
/** A bounded signature reuses the same oscillator/filter for every ride. */
export function vehicleMotorSignature(profile = {}, speed = 0, throttle = 0) {
  const velocity = Number.isFinite(speed) ? Math.min(60, Math.abs(speed)) : 0
  const load = Number.isFinite(throttle) ? Math.max(0, Math.min(1, throttle)) : 0
  return {
    hz: (profile.idleHz ?? 35) + velocity * (profile.speedHz ?? 4) + load * (profile.throttleHz ?? 8),
    cutoff: (profile.cutoff ?? 280) + load * 180,
    gain: (profile.gain ?? .04) + Math.min(.025, velocity * .0015),
    wave: profile.wave === 'triangle' ? 'triangle' : 'sawtooth',
  }
}
export function stepFootsteps(previous, player, enabled, config) {
  const fresh = { x: player.x, z: player.z, distance: 0, total: previous?.total || 0 }
  if (!Number.isFinite(player.x) || !Number.isFinite(player.z)) return { state: null, count: 0 }
  if (!previous || !enabled) return { state: fresh, count: 0 }
  const travel = Math.hypot(player.x - previous.x, player.z - previous.z)
  if (travel > config.teleportThreshold) return { state: fresh, count: 0 }
  const stride = Math.abs(player.speed || 0) > config.runSpeed ? config.runStride : config.walkStride
  const accumulated = previous.distance + travel
  const count = Math.min(4, Math.floor(accumulated / stride))
  return { state: { ...fresh, distance: accumulated % stride, total: fresh.total + count }, count }
}
