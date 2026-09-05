/** Pure rules for the optional street sprint and the garage handheld. */
export function createSprint(route, limit = 90) {
  return { route, limit, elapsed: 0, checkpoint: 0, status: 'racing' }
}
export function stepSprint(run, point, dt, driving) {
  if (run.status !== 'racing' || !Number.isFinite(dt) || dt <= 0) return
  run.elapsed += Math.min(dt, 0.1)
  if (!driving || run.elapsed >= run.limit) {
    run.status = 'lost'
    return
  }
  const target = run.route[run.checkpoint]
  if (target && Math.hypot(point.x - target.x, point.z - target.z) < 9) run.checkpoint++
  if (run.checkpoint === run.route.length) run.status = 'won'
}
export function createHandheld() {
  return {
    phase: 'ready',
    time: 0,
    x: 0,
    shield: 3,
    score: 0,
    cooldown: 0,
    obstacles: [],
    next: 0.8,
    serial: 0,
  }
}
export function stepHandheld(run, direction, dt) {
  if (run.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return
  dt = Math.min(dt, 0.05)
  run.time += dt
  run.x = Math.max(-1, Math.min(1, run.x + direction * dt * 2.5))
  run.cooldown = Math.max(0, run.cooldown - dt)
  run.next -= dt
  if (run.next <= 0) {
    const lane = [0, -0.75, 0.75, -0.75, 0, 0.75, 0][run.serial++ % 7]
    run.obstacles.push({ x: lane, z: 1 })
    run.next = Math.max(0.45, 1 - run.time / 100)
  }
  for (const obstacle of run.obstacles) {
    obstacle.z -= dt * (0.35 + run.time * 0.004)
    if (obstacle.z <= 0) {
      if (Math.abs(obstacle.x - run.x) < 0.28 && run.cooldown === 0) {
        run.shield--
        run.cooldown = 0.5
      } else run.score += 50
    }
  }
  run.obstacles = run.obstacles.filter((item) => item.z > 0)
  if (run.shield <= 0) run.phase = 'lost'
  else if (run.time >= 60) {
    run.phase = 'won'
    run.score += 500
  }
}
