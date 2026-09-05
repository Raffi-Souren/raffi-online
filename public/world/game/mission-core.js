/** Pure mission-state helpers. Browser wiring lives in missions.js. */

export const CONSTRAINT_KINDS = new Set(['timer', 'avoid'])
export const EFFECT_KINDS = new Set(['blackoutCity'])

/**
 * Normal campaign availability is stricter than receiving an unlock token:
 * authored parent missions must be complete, and the finale waits for every
 * non-finale job. Debug helpers may still start a mission directly for audits.
 */
export function missionPrerequisitesMet(mission, completedIds, allMissions = []) {
  const completed = completedIds instanceof Set ? completedIds : new Set(completedIds || [])
  const authored = Array.isArray(mission.unlockedBy)
    ? mission.unlockedBy
    : mission.unlockedBy
      ? [mission.unlockedBy]
      : []
  if (!authored.every((id) => completed.has(id))) return false
  if (!mission.finale) return true
  return allMissions.every((candidate) =>
    candidate.id === mission.id || candidate.finale || completed.has(candidate.id)
  )
}

export function isProgressKind(kind, handler = null) {
  if (CONSTRAINT_KINDS.has(kind)) return false
  if (kind === 'custom' && EFFECT_KINDS.has(handler)) return false
  return true
}

export function progressObjectives(mission) {
  return (mission.objectives || []).filter((objective) =>
    isProgressKind(objective.kind, objective.handler)
  )
}

function findObjective(mission, kind) {
  return mission.objectives.find((objective) => objective.kind === kind) || null
}

export function createMissionRun(mission) {
  const route = mission.objectives.find((objective) =>
    objective.kind === 'goto' || objective.kind === 'goto-vehicle'
  ) || null
  const timer = findObjective(mission, 'timer')
  const collect = findObjective(mission, 'collect')
  const rhythm = findObjective(mission, 'rhythm')
  const avoid = findObjective(mission, 'avoid')
  const escort = findObjective(mission, 'escort')
  const evade = findObjective(mission, 'evade')
  const customs = mission.objectives.filter((objective) => objective.kind === 'custom')
  return {
    mission,
    route,
    timer,
    collect,
    rhythm,
    avoid,
    escort,
    evade,
    customs,
    status: 'briefing',
    elapsed: 0,
    completedPointIndexes: [],
    collectedIndexes: [],
    rhythmHits: 0,
    rhythmMisses: 0,
    rhythmNextIndex: 0,
    lastSafe: null,
    avoidShuffleAt: 0,
    activeCells: [],
    escortBoarded: false,
    lastSpeedAt: -999,
    evadeArmed: false,
    customState: {},
    completedKinds: [],
    appliedEffects: [],
  }
}

export function activateMissionRun(run) {
  if (run.status === 'briefing') run.status = 'active'
  return run
}

function markKind(run, kind) {
  if (!run.completedKinds.includes(kind)) run.completedKinds.push(kind)
}

function kindDone(run, kind) {
  return run.completedKinds.includes(kind)
}

function routeReady(run) {
  if (!run.collect) return true
  return kindDone(run, 'collect')
}

export function allProgressComplete(run) {
  const needed = progressObjectives(run.mission)
  if (!needed.length) return false
  return needed.every((objective) => {
    const key = objective.kind === 'custom' ? 'custom:' + objective.handler : objective.kind
    if (objective.kind === 'goto' || objective.kind === 'goto-vehicle') {
      return kindDone(run, objective.kind)
    }
    return kindDone(run, key) || kindDone(run, objective.kind)
  })
}

function maybeComplete(run, events) {
  if (run.status !== 'active') return
  if (!allProgressComplete(run)) return
  run.status = 'complete'
  events.push({ type: 'complete' })
}

function stepRoute(run, actor, events) {
  const route = run.route
  if (!route?.points?.length || kindDone(run, route.kind)) return
  if (!routeReady(run)) return
  if (route.kind === 'goto-vehicle' && actor.mode !== 'vehicle') return

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
      line: finishesRoute ? null : route.onEach?.line || null,
      complianceDelta: route.onEach?.complianceDelta || 0,
    })
    if (finishesRoute) {
      markKind(run, route.kind)
      events.push({ type: 'route-complete', kind: route.kind })
    }
    break
  }
}

function stepCollect(run, actor, events) {
  const collect = run.collect
  if (!collect || kindDone(run, 'collect')) return
  const radius = collect.radius || 2.2
  const needed = collect.count || collect.points?.length || 0
  const taken = new Set(run.collectedIndexes)
  for (let index = 0; index < (collect.points || []).length; index++) {
    if (taken.has(index)) continue
    const point = collect.points[index]
    if (Math.hypot(point.x - actor.x, point.z - actor.z) > radius) continue
    run.collectedIndexes.push(index)
    events.push({
      type: 'collect',
      index,
      tag: collect.tag || null,
      line: collect.onEach?.line || null,
      remaining: needed - run.collectedIndexes.length,
    })
    break
  }
  if (run.collectedIndexes.length >= needed) {
    markKind(run, 'collect')
    events.push({ type: 'collect-complete' })
  }
}

export function rhythmTotalHits(spec) {
  // 4/4 bars. `subdivision` only tightens the hit window / booth grid.
  return Math.max(1, (spec.bars || 32) * 4)
}

export function rhythmBeatInterval(_spec, bpm) {
  return 60 / Math.max(40, bpm || 120)
}

function stepRhythm(run, actor, dt, events) {
  const spec = run.rhythm
  if (!spec || kindDone(run, 'rhythm')) return
  const interval = rhythmBeatInterval(spec, actor.bpm)
  const window = Math.max(0.04, (spec.windowMs || 110) / 1000)
  const total = rhythmTotalHits(spec)
  const dueAt = (run.rhythmNextIndex + 1) * interval
  const late = run.elapsed - dueAt

  if (actor.pulse && run.rhythmNextIndex < total) {
    if (Math.abs(late) <= window) {
      run.rhythmHits += 1
      run.rhythmNextIndex += 1
      events.push({ type: 'rhythm-hit', hits: run.rhythmHits, next: run.rhythmNextIndex })
    } else {
      run.rhythmMisses += 1
      events.push({
        type: 'rhythm-miss',
        line: spec.missLine || null,
        spawn: spec.onMiss?.spawn || null,
        max: spec.onMiss?.max || 0,
        misses: run.rhythmMisses,
      })
    }
  } else if (late > window && run.rhythmNextIndex < total) {
    run.rhythmMisses += 1
    run.rhythmNextIndex += 1
    events.push({
      type: 'rhythm-miss',
      line: spec.missLine || null,
      spawn: spec.onMiss?.spawn || null,
      max: spec.onMiss?.max || 0,
      misses: run.rhythmMisses,
    })
  }

  if (run.rhythmMisses >= (spec.failAfterMisses || 6)) {
    run.status = 'failed'
    events.push({ type: 'failed', line: spec.failLine || 'm-set-time-fail' })
    return
  }
  if (run.rhythmHits >= total) {
    markKind(run, 'rhythm')
    events.push({ type: 'rhythm-complete' })
  }
}

export function buildSensorCells(spec, origin = { x: 0, z: 0 }) {
  const grid = spec.sensorGrid || {}
  const rows = grid.rows || 7
  const cols = grid.cols || 9
  const cellSize = grid.cellSize || 4
  const ox = origin.x - (cols * cellSize) / 2 + cellSize / 2
  const oz = origin.z - (rows * cellSize) / 2 + cellSize / 2
  const cells = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        id: row * cols + col,
        row,
        col,
        x: ox + col * cellSize,
        z: oz + row * cellSize,
        size: cellSize,
        active: false,
      })
    }
  }
  return cells
}

export function shuffleSensorCells(cells, spec, rng = Math.random) {
  const fraction = spec.sensorGrid?.activeFraction ?? 0.34
  const count = Math.max(1, Math.round(cells.length * fraction))
  const order = cells.map((cell, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  const live = new Set(order.slice(0, count))
  for (const cell of cells) cell.active = live.has(cell.id)
  return cells
}

function cellAt(cells, x, z) {
  for (const cell of cells) {
    if (Math.abs(cell.x - x) <= cell.size / 2 && Math.abs(cell.z - z) <= cell.size / 2) {
      return cell
    }
  }
  return null
}

function stepAvoid(run, actor, events) {
  const spec = run.avoid
  if (!spec) return
  if (!run.activeCells.length) {
    run.activeCells = shuffleSensorCells(
      buildSensorCells(spec, spec.origin || { x: 0, z: 0 }),
      spec,
    )
    run.avoidShuffleAt = run.elapsed + (spec.sensorGrid?.shufflePeriod || 5.5)
  }
  if (run.elapsed >= run.avoidShuffleAt) {
    shuffleSensorCells(run.activeCells, spec)
    run.avoidShuffleAt = run.elapsed + (spec.sensorGrid?.shufflePeriod || 5.5)
    events.push({ type: 'sensors-shuffle', cells: run.activeCells })
  }
  const cell = cellAt(run.activeCells, actor.x, actor.z)
  if (cell && !cell.active) {
    run.lastSafe = { x: actor.x, z: actor.z }
  } else if (!cell && run.lastSafe === null) {
    run.lastSafe = { x: actor.x, z: actor.z }
  }
  if (cell?.active) {
    const safe = run.lastSafe || spec.origin || { x: 0, z: 0 }
    events.push({
      type: 'sensor-trip',
      line: spec.onTrip?.line || null,
      respawn: spec.onTrip?.respawnAtLastSafe ? safe : null,
      penaltySeconds: spec.onTrip?.penaltySeconds || 0,
    })
    if (spec.onTrip?.respawnAtLastSafe) {
      run.lastSafe = safe
    }
    if (spec.onTrip?.penaltySeconds) {
      run.elapsed += spec.onTrip.penaltySeconds
    }
    // Step off the live tile so one walk-on does not retrigger every frame.
    if (run.lastSafe) {
      actor.x = run.lastSafe.x
      actor.z = run.lastSafe.z
    }
  }
}

function stepEscort(run, actor, events) {
  const spec = run.escort
  if (!spec || kindDone(run, 'escort')) return
  const radius = spec.radius || 8
  if (!run.escortBoarded) {
    if (actor.mode === 'vehicle' && Math.hypot(spec.from.x - actor.x, spec.from.z - actor.z) <= radius) {
      run.escortBoarded = true
      events.push({ type: 'escort-board', passenger: spec.passenger || null })
    }
    return
  }
  const speed = actor.speed || 0
  if (speed > (spec.speedLimit || 22)) {
    const cool = spec.onSpeed?.cooldownSeconds || 6
    if (run.elapsed - run.lastSpeedAt >= cool) {
      run.lastSpeedAt = run.elapsed
      events.push({
        type: 'escort-speed',
        line: spec.onSpeed?.line || null,
        complianceDelta: spec.onSpeed?.complianceDelta || 0,
      })
    }
  }
  const compliance = actor.compliance ?? 0
  if (spec.failIfComplianceAtLeast != null && compliance >= spec.failIfComplianceAtLeast) {
    run.status = 'failed'
    events.push({ type: 'failed', line: spec.failLine || 'm-escort-fail' })
    return
  }
  if (Math.hypot(spec.to.x - actor.x, spec.to.z - actor.z) <= radius) {
    markKind(run, 'escort')
    events.push({ type: 'escort-complete' })
  }
}

function stepEvade(run, actor, events) {
  const spec = run.evade
  if (!spec || kindDone(run, 'evade')) return
  if (!run.evadeArmed) {
    run.evadeArmed = true
    events.push({ type: 'evade-start', compliance: spec.startCompliance || 0 })
    // The browser applies this escalation after the pure step returns. Do not
    // read the pre-escalation actor snapshot in the same frame or a stale zero
    // will complete BLACKOUT before the chase has even started.
    return
  }
  if ((actor.compliance ?? 0) <= 0) {
    markKind(run, 'evade')
    events.push({ type: 'evade-complete' })
  }
}

export function createShootoutState(spec) {
  return {
    rounds: spec.rounds || 5,
    winAt: spec.winAt || 3,
    scored: 0,
    missed: 0,
    taken: 0,
    phase: 'aim',
    keeperDive: 0,
    tell: 0,
    honest: true,
    tellTimer: 0,
    resolveTimer: 0,
  }
}

export function beginShootoutRound(state, spec, rng = Math.random) {
  const honest = rng() < (spec.keeperTell?.readableFraction ?? 0.75)
  const dive = rng() < 0.5 ? -1 : 1
  const tell = honest ? dive : -dive
  state.phase = 'aim'
  state.keeperDive = dive
  state.tell = tell
  state.honest = honest
  state.tellTimer = (spec.keeperTell?.leadFrames || 14) / 60
  state.resolveTimer = 0
  return state
}

export function resolveShootoutKick(state, aim) {
  const scored = aim !== 0 && aim !== state.keeperDive
  state.taken += 1
  if (scored) state.scored += 1
  else state.missed += 1
  state.phase = 'resolve'
  state.resolveTimer = 0.7
  return scored
}

function stepShootout(run, actor, dt, events) {
  const spec = run.customs.find((item) => item.handler === 'penaltyShootout')
  if (!spec || kindDone(run, 'custom:penaltyShootout')) return
  if (!run.customState.shootout) {
    run.customState.shootout = beginShootoutRound(createShootoutState(spec), spec, actor.rng || Math.random)
    events.push({ type: 'shootout-round', state: run.customState.shootout })
  }
  const shoot = run.customState.shootout
  if (shoot.phase === 'aim') {
    shoot.tellTimer = Math.max(0, shoot.tellTimer - dt)
    if (actor.kick) {
      const scored = resolveShootoutKick(shoot, actor.aim || 0)
      events.push({
        type: scored ? 'shootout-score' : 'shootout-miss',
        line: scored ? spec.scoreLine : spec.missLine,
        scored: shoot.scored,
        missed: shoot.missed,
        taken: shoot.taken,
      })
    }
  } else if (shoot.phase === 'resolve') {
    shoot.resolveTimer -= dt
    if (shoot.resolveTimer > 0) return
    if (shoot.scored >= shoot.winAt) {
      markKind(run, 'custom:penaltyShootout')
      events.push({ type: 'shootout-complete' })
      return
    }
    if (shoot.taken >= shoot.rounds || shoot.missed > shoot.rounds - shoot.winAt) {
      run.status = 'failed'
      events.push({ type: 'failed', line: spec.failLine || 'm-shootout-miss' })
      return
    }
    beginShootoutRound(shoot, spec, actor.rng || Math.random)
    events.push({ type: 'shootout-round', state: shoot })
  }
}

function applyEffects(run, events) {
  for (const spec of run.customs) {
    if (!EFFECT_KINDS.has(spec.handler)) continue
    if (run.appliedEffects.includes(spec.handler)) continue
    run.appliedEffects.push(spec.handler)
    markKind(run, 'custom:' + spec.handler)
    events.push({ type: 'effect', handler: spec.handler, spec })
  }
}

export function stepMissionRun(run, actor, dt) {
  const events = []
  if (run.status !== 'active') return events

  run.elapsed += Math.max(0, dt)
  const limit = run.timer?.seconds || null
  if (limit !== null && run.elapsed >= limit) {
    run.status = 'failed'
    events.push({ type: 'failed', line: run.timer?.failLine || null })
    return events
  }

  applyEffects(run, events)
  stepCollect(run, actor, events)
  if (run.status !== 'active') return events
  stepRoute(run, actor, events)
  if (run.status !== 'active') return events
  stepRhythm(run, actor, dt, events)
  if (run.status !== 'active') return events
  stepAvoid(run, actor, events)
  if (run.status !== 'active') return events
  stepEscort(run, actor, events)
  if (run.status !== 'active') return events
  stepEvade(run, actor, events)
  if (run.status !== 'active') return events
  stepShootout(run, actor, dt, events)
  if (run.status !== 'active') return events

  maybeComplete(run, events)
  return events
}

export function nextMissionPoint(run, actor) {
  if (!run) return null
  if (run.collect && !kindDone(run, 'collect')) {
    const remaining = run.collect.points
      .map((point, index) => ({ point, index, kind: 'collect' }))
      .filter(({ index }) => !run.collectedIndexes.includes(index))
    if (!remaining.length) return null
    remaining.sort((a, b) =>
      Math.hypot(a.point.x - actor.x, a.point.z - actor.z) -
      Math.hypot(b.point.x - actor.x, b.point.z - actor.z)
    )
    return remaining[0]
  }
  if (run.escort && !kindDone(run, 'escort')) {
    const point = run.escortBoarded ? run.escort.to : run.escort.from
    return { point, index: run.escortBoarded ? 1 : 0, kind: 'escort' }
  }
  const route = run.route
  if (!route?.points?.length || kindDone(run, route.kind) || !routeReady(run)) return null
  const completed = new Set(run.completedPointIndexes)
  const remaining = route.points
    .map((point, index) => ({ point, index, kind: route.kind }))
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

export function formatObjective(run, templates = {}) {
  if (!run) return ''
  const clock = formatMissionClock(missionSecondsRemaining(run))
  if (run.collect && !kindDone(run, 'collect')) {
    const done = run.collectedIndexes.length
    const total = run.collect.count || run.collect.points.length
    return (templates.collect || 'RECOVER RECORDS ({done}/{total})')
      .replace('{done}', String(done))
      .replace('{total}', String(total)) + ' · ' + clock
  }
  if (run.rhythm && !kindDone(run, 'rhythm')) {
    return (templates.rhythm || 'STAY ON THE GRID ({bars} BARS)')
      .replace('{bars}', String(run.rhythm.bars || 0)) +
      ` · ${run.rhythmHits}/${rhythmTotalHits(run.rhythm)} · ${clock}`
  }
  if (run.escort && !kindDone(run, 'escort')) {
    const verb = run.escortBoarded ? (templates.escort || 'DELIVER YOUR PASSENGER') : 'PICK UP YOUR PASSENGER'
    return verb + ' · ' + clock
  }
  if (run.customs.some((item) => item.handler === 'penaltyShootout') && !kindDone(run, 'custom:penaltyShootout')) {
    const shoot = run.customState.shootout
    const scored = shoot?.scored || 0
    const winAt = shoot?.winAt || 3
    return `PENALTY (${scored}/${winAt}) · ${clock}`
  }
  if (run.route && !kindDone(run, run.route.kind) && routeReady(run)) {
    const total = run.route.points.length
    const done = run.completedPointIndexes.length
    const verb = run.route.kind === 'goto-vehicle'
      ? (templates['goto-vehicle'] || 'DRIVE TO THE MARKER ({done}/{total})')
      : (templates.goto || 'GET TO THE MARKER')
    return verb.replace('{done}', String(done)).replace('{total}', String(total)) + ' · ' + clock
  }
  if (run.evade && !kindDone(run, 'evade')) {
    return (templates.evade || 'LOSE THEM') + ' · ' + clock
  }
  if (run.avoid) return (templates.avoid || 'DO NOT TRIP A SENSOR') + ' · ' + clock
  return clock
}
