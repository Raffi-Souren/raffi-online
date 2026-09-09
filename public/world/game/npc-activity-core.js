/** Existing-pool sidewalk errands, deliberate pauses and safe crossing entry. */
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
export function createActivityState() { return { index: 1, arrived: false, remaining: 0, crossing: false } }

/** Conservative swept vehicle bounds: wait on the curb, then finish crossing. */
export function crossingClear(from, to, vehicles, horizon = 3.5) {
  const minX = Math.min(from.x, to.x) - 0.8, maxX = Math.max(from.x, to.x) + 0.8
  const minZ = Math.min(from.z, to.z) - 0.8, maxZ = Math.max(from.z, to.z) + 0.8
  for (const car of vehicles || []) {
    if (Math.abs(car.y || 0) > 2.2) continue
    const speed = Number.isFinite(car.speed) ? car.speed : 0
    const sx = Math.sin(car.yaw || 0), sz = Math.cos(car.yaw || 0)
    const x1 = car.x + sx * speed * horizon, z1 = car.z + sz * speed * horizon
    const hx = Math.abs(sz) * (car.width || 1.8) / 2 + Math.abs(sx) * (car.length || 4.4) / 2
    const hz = Math.abs(sx) * (car.width || 1.8) / 2 + Math.abs(sz) * (car.length || 4.4) / 2
    if (Math.min(car.x, x1) - hx < maxX && Math.max(car.x, x1) + hx > minX && Math.min(car.z, z1) - hz < maxZ && Math.max(car.z, z1) + hz > minZ) return false
  }
  return true
}

/** Mutates only the small activity cursor, never position or the world clock. */
export function planActivity(activity, run, position, dt, vehicles = []) {
  if (!activity?.points?.length) return null
  let target = activity.points[run.index % activity.points.length]
  if (distance(position, target) <= 0.45) {
    if (!run.arrived) { run.arrived = true; run.remaining = target.pause || 0; run.crossing = false }
    run.remaining = Math.max(0, run.remaining - Math.max(0, Math.min(dt || 0, 0.25)))
    if (run.remaining > 0) return { verb: target.verb || 'idle', target: `${activity.id}:${run.index}`, x: target.x, z: target.z, yaw: target.yaw, waiting: false, present: !(target.inside && run.remaining < (target.pause || 0) - 0.6) }
    run.index = (run.index + 1) % activity.points.length; run.arrived = false
    target = activity.points[run.index]
  }
  if (target.crossing && !run.crossing) {
    const horizon = Math.max(3.5, distance(position, target) / (activity.walkSpeed || 1.3) + 0.8)
    if (!crossingClear(position, target, vehicles, horizon)) return { verb: 'idle', target: `${activity.id}:wait-crossing`, x: position.x, z: position.z, waiting: true }
    run.crossing = true
  }
  return { verb: 'walk', target: `${activity.id}:${run.index}`, x: target.x, z: target.z, waiting: false }
}
