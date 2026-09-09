/** Bounded 60Hz simulation. Rendering may run faster or slower than physics. */
export function createFixedClock({ hz = 60, maxSteps = 8 } = {}) {
  const step = 1 / hz
  let remainder = 0, dropped = 0
  return {
    step,
    reset() { remainder = 0 },
    advance(elapsed, tick) {
      const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
      const accepted = Math.min(seconds, step * maxSteps)
      dropped += seconds - accepted
      remainder += accepted
      let steps = 0
      while (remainder + 1e-10 >= step && steps < maxSteps) {
        remainder = Math.max(0, remainder - step)
        steps++
        if (tick(step) === false) { remainder = 0; break }
      }
      return { steps, alpha: Math.min(1, remainder / step), droppedSeconds: dropped }
    },
  }
}

/** Interpolate the short arc; never sweep the camera through a teleported room. */
export function interpolatePlayer(previous, current, alpha) {
  if (!previous || Math.hypot(current.x - previous.x, current.z - previous.z, (current.y || 0) - (previous.y || 0)) > 16) return { ...current }
  const t = Math.max(0, Math.min(1, alpha))
  const yaw = Math.atan2(Math.sin(current.yaw - previous.yaw), Math.cos(current.yaw - previous.yaw))
  return { ...current, x: previous.x + (current.x - previous.x) * t, y: (previous.y || 0) + ((current.y || 0) - (previous.y || 0)) * t, z: previous.z + (current.z - previous.z) * t, yaw: previous.yaw + yaw * t }
}
