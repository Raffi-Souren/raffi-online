/** Pure mission-state helpers. Browser wiring lives in missions.js. */

export function createMissionRun(mission) {
  const route = mission.objectives.find((objective) =>
    objective.kind === 'goto' || objective.kind === 'goto-vehicle'
  ) || null
  const timer = mission.objectives.find((objective) => objective.kind === 'timer') || null
  return {
    mission,
    route,
    timer,
    status: 'briefing',
    elapsed: 0,
    completedPointIndexes: [],
  }
}

export function activateMissionRun(run) {
  if (run.status === 'briefing') run.status = 'active'
  return run
}

export function stepMissionRun(run, actor, dt) {
  const events = []
  if (run.status !== 'active') return events

  run.elapsed += Math.max(0, dt)
  const limit = run.timer?.seconds || run.mission.targetSeconds || null
  if (limit !== null && run.elapsed >= limit) {
    run.status = 'failed'
    events.push({ type: 'failed', line: run.timer?.failLine || null })
    return events
  }

  const route = run.route
  if (!route?.points?.length) return events
  if (route.kind === 'goto-vehicle' && actor.mode !== 'vehicle') return events

  const completed = new Set(run.completedPointIndexes)
  const candidates = route.ordered
    ? [completed.size]
    : route.points.map((_, index) => index).filter((index) => !completed.has(index))

  for (const index of candidates) {
    const point = route.points[index]
    if (!point) continue
    if (Math.hypot(point.x - actor.x, point.z - actor.z) > (route.radius || 4)) continue
    if (completed.has(index)) continue

    run.completedPointIndexes.push(index)
    const finishesRoute = run.completedPointIndexes.length >= route.points.length
    events.push({
      type: 'point',
      index,
      // “Next stop” copy is wrong on the same frame that completes the route.
      line: finishesRoute ? null : route.onEach?.line || null,
      complianceDelta: route.onEach?.complianceDelta || 0,
    })
    if (finishesRoute) {
      run.status = 'complete'
      events.push({ type: 'complete' })
    }
    break
  }

  return events
}

export function nextMissionPoint(run, actor) {
  const route = run.route
  if (!route?.points?.length) return null
  const completed = new Set(run.completedPointIndexes)
  const remaining = route.points
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => !completed.has(index))
  if (!remaining.length) return null
  if (route.ordered) return remaining[0]
  remaining.sort((a, b) =>
    Math.hypot(a.point.x - actor.x, a.point.z - actor.z) -
    Math.hypot(b.point.x - actor.x, b.point.z - actor.z)
  )
  return remaining[0]
}

export function missionSecondsRemaining(run) {
  const limit = run.timer?.seconds || run.mission.targetSeconds || 0
  return Math.max(0, limit - run.elapsed)
}

export function formatMissionClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds))
  return String(Math.floor(whole / 60)).padStart(2, '0') + ':' +
    String(whole % 60).padStart(2, '0')
}
